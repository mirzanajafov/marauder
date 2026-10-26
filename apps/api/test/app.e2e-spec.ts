import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { FloorPlan as FloorPlanRow } from '@prisma/client';
import { DEFAULT_FLOORPLAN_ID, EntityDiscoveredEvent, WsEvents } from '@marauder/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { isRecord } from '../src/common/is-record';
import { configureApp } from '../src/configure-app';
import { ResolutionService } from '../src/entities/resolution.service';
import { PrismaService } from '../src/prisma/prisma.service';

function rowsWhere(body: unknown, field: string, value: unknown): unknown[] {
  if (!Array.isArray(body)) {
    throw new Error(`expected a list, got ${JSON.stringify(body)}`);
  }
  return body.filter((row: unknown) => isRecord(row) && row[field] === value);
}

function textField(body: unknown, key: string): string {
  const value = isRecord(body) ? body[key] : undefined;
  if (typeof value !== 'string') {
    throw new Error(`expected a string ${key} in ${JSON.stringify(body)}`);
  }
  return value;
}

describe('API against Postgres and Redis', () => {
  let app: NestExpressApplication;
  let server: Server;
  let prisma: PrismaService;
  let webOrigin: string;
  let adminPassword: string;
  let token: string;

  const auth = (): string => `Bearer ${token}`;
  const login = (password: string) => request(server).post('/auth/login').send({ password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    const config = configureApp(app);
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    webOrigin = config.get('WEB_ORIGIN', { infer: true });
    adminPassword = config.get('ADMIN_PASSWORD', { infer: true });
    token = textField((await login(adminPassword).expect(201)).body, 'token');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health and CORS', () => {
    it('reports health', async () => {
      await request(server).get('/health').expect(200).expect({ status: 'ok' });
    });

    it('allows the web origin and no other', async () => {
      const allowed = await request(server).get('/health').set('Origin', webOrigin).expect(200);
      expect(allowed.headers['access-control-allow-origin']).toBe(webOrigin);
      const foreign = await request(server).get('/health').set('Origin', 'https://elsewhere.example').expect(200);
      expect(foreign.headers['access-control-allow-origin']).not.toBe('https://elsewhere.example');
    });

    it('lets the web origin send authorized writes', async () => {
      const preflight = await request(server)
        .options('/floorplan')
        .set('Origin', webOrigin)
        .set('Access-Control-Request-Method', 'PUT')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(webOrigin);
      expect(preflight.headers['access-control-allow-methods']).toContain('PUT');
      expect(preflight.headers['access-control-allow-headers']?.toLowerCase()).toContain('authorization');
    });
  });

  describe('entities', () => {
    let entityId: string;

    beforeAll(async () => {
      entityId = (await prisma.entity.create({ data: { fingerprint: `e2e-${randomUUID()}` } })).id;
    });

    afterAll(async () => {
      await prisma.entity.delete({ where: { id: entityId } });
    });

    it('refuses to tag without a token', async () => {
      await request(server).patch(`/entities/${entityId}`).send({ name: 'No Auth' }).expect(401);
    });

    it('tags an entity and lists it as tagged', async () => {
      const tagged = await request(server)
        .patch(`/entities/${entityId}`)
        .set('Authorization', auth())
        .send({ name: 'Test Subject', kind: 'person' })
        .expect(200);
      expect(tagged.body).toMatchObject({ id: entityId, name: 'Test Subject', kind: 'person', status: 'tagged' });

      const list = await request(server).get('/entities').expect(200);
      expect(rowsWhere(list.body, 'id', entityId)).toMatchObject([{ status: 'tagged' }]);
    });

    it('answers 404 for an entity that does not exist', async () => {
      await request(server)
        .get(`/entities/${randomUUID()}`)
        .expect(404)
        .expect({ message: 'entity not found', error: 'Not Found', statusCode: 404 });
    });

    it('answers 404 when tagging an entity that does not exist', async () => {
      await request(server)
        .patch(`/entities/${randomUUID()}`)
        .set('Authorization', auth())
        .send({ name: 'Nobody' })
        .expect(404);
    });

    it('gives a first sighting a v4 uuid and the unknown status', async () => {
      const fingerprint = `e2e-first-${randomUUID()}`;
      try {
        const id = await app.get(ResolutionService).resolve(fingerprint);
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        await expect(prisma.entity.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
          fingerprint,
          status: 'unknown',
          name: null,
          kind: null,
        });
      } finally {
        await prisma.entity.deleteMany({ where: { fingerprint } });
      }
    });

    it('creates one entity and announces it once when four first sightings of a fingerprint race', async () => {
      const racing = `e2e-race-${randomUUID()}`;
      const events = app.get(EventEmitter2);
      const announced: string[] = [];
      const listener = (event: EntityDiscoveredEvent): void => {
        announced.push(event.entity.fingerprint);
      };
      events.on(WsEvents.EntityDiscovered, listener);
      try {
        const sightings = await Promise.all([1, 2, 3, 4].map(() => app.get(ResolutionService).resolve(racing)));

        expect(new Set(sightings).size).toBe(1);
        expect(await prisma.entity.count({ where: { fingerprint: racing } })).toBe(1);
        expect(announced.filter((fingerprint) => fingerprint === racing)).toHaveLength(1);
      } finally {
        events.off(WsEvents.EntityDiscovered, listener);
        await prisma.entity.deleteMany({ where: { fingerprint: racing } });
      }
    });
  });

  describe('receivers', () => {
    const newReceiver = () => ({ id: `e2e-${randomUUID().slice(0, 8)}`, name: 'E2E', x: 1, y: 2 });

    it('creates, lists, moves and deletes a receiver with a token', async () => {
      const receiver = newReceiver();
      const { id } = receiver;
      await request(server).post('/receivers').send(receiver).expect(401);
      const created = await request(server).post('/receivers').set('Authorization', auth()).send(receiver).expect(201);
      try {
        expect(created.body).toEqual({ ...receiver, floor: 0 });

        const list = await request(server).get('/receivers').expect(200);
        expect(rowsWhere(list.body, 'id', id)).toEqual([{ ...receiver, floor: 0 }]);

        const moved = await request(server)
          .patch(`/receivers/${id}`)
          .set('Authorization', auth())
          .send({ x: 5 })
          .expect(200);
        expect(moved.body).toEqual({ ...receiver, x: 5, floor: 0 });
      } finally {
        await request(server).delete(`/receivers/${id}`).set('Authorization', auth()).expect(204);
      }
    });

    it('answers 409 for an id that is taken', async () => {
      const receiver = newReceiver();
      await request(server).post('/receivers').set('Authorization', auth()).send(receiver).expect(201);
      try {
        const duplicate = await request(server)
          .post('/receivers')
          .set('Authorization', auth())
          .send(receiver)
          .expect(409);
        expect(duplicate.body).toMatchObject({ message: 'receiver with this id already exists' });
      } finally {
        await request(server).delete(`/receivers/${receiver.id}`).set('Authorization', auth()).expect(204);
      }
    });

    it('answers 404 when moving or deleting a receiver that does not exist', async () => {
      const { id } = newReceiver();
      await request(server).patch(`/receivers/${id}`).set('Authorization', auth()).send({ name: 'gone' }).expect(404);
      await request(server).delete(`/receivers/${id}`).set('Authorization', auth()).expect(404);
    });

    it('refuses a coordinate or floor that is not a usable number instead of coercing it', async () => {
      const receiver = newReceiver();
      try {
        for (const invalid of [{ floor: null }, { floor: true }, { floor: 3_000_000_000 }, { x: '' }, { x: '5' }]) {
          await request(server)
            .post('/receivers')
            .set('Authorization', auth())
            .send({ ...receiver, ...invalid })
            .expect(400);
        }
        for (const invalid of [{ x: null }, { x: false }, { y: ' ' }]) {
          await request(server)
            .patch(`/receivers/${receiver.id}`)
            .set('Authorization', auth())
            .send(invalid)
            .expect(400);
        }
      } finally {
        await request(server).delete(`/receivers/${receiver.id}`).set('Authorization', auth());
      }
    });
  });

  describe('floor plan', () => {
    const where = { id: DEFAULT_FLOORPLAN_ID };
    let stored: FloorPlanRow | null;

    beforeAll(async () => {
      stored = await prisma.floorPlan.findUnique({ where });
    });

    afterAll(async () => {
      if (stored) {
        const { imageUrl, width, height, floor } = stored;
        await request(server)
          .put('/floorplan')
          .set('Authorization', auth())
          .send({ imageUrl, width, height, floor })
          .expect(200);
      } else {
        await prisma.floorPlan.deleteMany({ where });
      }
    });

    it('stores a new floor plan with a token and serves it back', async () => {
      const plan = { imageUrl: 'https://example.com/e2e-plan.png', width: 33.5, height: 21, floor: 0 };

      await request(server).put('/floorplan').send(plan).expect(401);
      await request(server).put('/floorplan').set('Authorization', auth()).send(plan).expect(200).expect(plan);
      await request(server).get('/floorplan').expect(200).expect(plan);
    });

    it('refuses a floor that is null or outside the building', async () => {
      for (const floor of [null, 3_000_000_000]) {
        await request(server)
          .put('/floorplan')
          .set('Authorization', auth())
          .send({ width: 30, height: 20, floor })
          .expect(400);
      }
    });
  });

  describe('history', () => {
    const withPositions = async (
      entity: { name?: string; status?: 'tagged' },
      positions: { time: Date; x: number; y: number; accuracy: number }[],
      check: (entityId: string) => Promise<void>,
    ): Promise<void> => {
      const { id } = await prisma.entity.create({ data: { fingerprint: `e2e-history-${randomUUID()}`, ...entity } });
      try {
        await prisma.position.createMany({ data: positions.map((position) => ({ ...position, entityId: id })) });
        await check(id);
      } finally {
        await prisma.position.deleteMany({ where: { entityId: id } });
        await prisma.entity.delete({ where: { id } });
      }
    };
    it('reports the recorded time range without a row count', async () => {
      const summary: unknown = (await request(server).get('/history/summary').expect(200)).body;
      if (!isRecord(summary)) {
        throw new Error(`expected an object, got ${JSON.stringify(summary)}`);
      }
      expect(Object.keys(summary).sort()).toEqual(['from', 'to']);
    });

    it('averages the positions in each bucket and adds the name and status of the entity', async () => {
      const bucket = Math.floor(Date.now() / 1000) * 1000 - 60_000;
      const positions = [
        { time: new Date(bucket + 250), x: 2, y: 4, accuracy: 1 },
        { time: new Date(bucket + 750), x: 4, y: 6, accuracy: 3 },
      ];
      await withPositions({ name: 'Ada', status: 'tagged' }, positions, async (entityId) => {
        const from = new Date(bucket).toISOString();
        const to = new Date(bucket + 999).toISOString();
        const res = await request(server).get(`/history?from=${from}&to=${to}&bucketMs=1000`).expect(200);
        expect(rowsWhere(res.body, 'entityId', entityId)).toEqual([
          { entityId, x: 3, y: 5, accuracy: 2, time: bucket, name: 'Ada', status: 'tagged' },
        ]);
      });
    });

    it('shows the ten minutes up to the newest position when the window is left open', async () => {
      const recent = Date.now() - 1_000;
      await withPositions({ name: 'Ada' }, [{ time: new Date(recent), x: 2, y: 4, accuracy: 1 }], async (entityId) => {
        const res = await request(server).get('/history?bucketMs=1000').expect(200);
        expect(rowsWhere(res.body, 'entityId', entityId)).toEqual([
          { entityId, x: 2, y: 4, accuracy: 1, time: Math.floor(recent / 1000) * 1000, name: 'Ada', status: 'unknown' },
        ]);
      });
    });

    it('refuses a window that is upside down, not a timestamp or needs more than two thousand buckets', async () => {
      await request(server).get('/history?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&bucketMs=500').expect(400);
      await request(server).get('/history?from=2026-01-01T00:10:00Z&to=2026-01-01T00:00:00Z&bucketMs=500').expect(400);
      await request(server).get('/history?from=yesterday').expect(400);
      await request(server).get('/history?from=2026-01-01T00:00:00Z&to=2026-01-01T01:00:00Z&bucketMs=3000').expect(200);
    });

    it('returns no points for a window that starts after the newest position', async () => {
      await withPositions({}, [{ time: new Date(), x: 1, y: 1, accuracy: 1 }], async () => {
        await request(server).get('/history?from=2999-01-01T00:00:00Z').expect(200).expect([]);
      });
    });
  });

  describe('sessions', () => {
    it('refuses a wrong password', async () => {
      await login('nope').expect(401);
    });

    it('revokes a token on logout until it would have expired, drops lapsed revocations and leaves other sessions alone', async () => {
      const lapsed = { jti: randomUUID(), expiresAt: new Date(Date.now() - 1000) };
      const live = { jti: randomUUID(), expiresAt: new Date(Date.now() + 60_000) };
      await prisma.revokedToken.createMany({ data: [lapsed, live] });
      const issued = textField((await login(adminPassword).expect(201)).body, 'token');
      const { jti, exp } = app.get(JwtService).decode<{ jti: string; exp: number }>(issued);
      const jtis = [lapsed.jti, live.jti, jti];
      const session = `Bearer ${issued}`;
      await request(server).get('/auth/me').set('Authorization', session).expect(200);

      await request(server).post('/auth/logout').set('Authorization', session).expect(204);

      try {
        const refused = await request(server).get('/auth/me').set('Authorization', session).expect(401);
        expect(textField(refused.body, 'message')).toBe('token revoked');
        await request(server).get('/auth/me').set('Authorization', auth()).expect(200);
        const left = await prisma.revokedToken.findMany({
          where: { jti: { in: jtis } },
          orderBy: { expiresAt: 'asc' },
        });
        expect(left).toEqual([live, { jti, expiresAt: new Date(exp * 1000) }]);
      } finally {
        await prisma.revokedToken.deleteMany({ where: { jti: { in: jtis } } });
      }
    });

    it('takes the same session revoked twice, as two logouts racing would', async () => {
      const session = { jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 60 };
      try {
        await app.get(AuthService).revoke(session);
        await expect(app.get(AuthService).revoke(session)).resolves.toBeUndefined();
      } finally {
        await prisma.revokedToken.deleteMany({ where: { jti: session.jti } });
      }
    });
  });
});
