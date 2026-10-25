import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let entityId: string;
  let token: string;
  const fingerprint = `e2e-${randomUUID()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const row = await prisma.entity.create({
      data: { id: randomUUID(), fingerprint, status: 'unknown' },
    });
    entityId = row.id;
    const password = app.get(ConfigService).getOrThrow<string>('ADMIN_PASSWORD');
    const login = await request(app.getHttpServer()).post('/auth/login').send({ password }).expect(201);
    token = login.body.token;
  });

  afterAll(async () => {
    if (prisma && entityId) {
      await prisma.entity.delete({ where: { id: entityId } }).catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
  });

  const auth = (): string => `Bearer ${token}`;
  const newReceiver = (): { id: string; name: string; x: number; y: number } => ({
    id: `e2e-rx-${randomUUID().slice(0, 8)}`,
    name: 'E2E',
    x: 1,
    y: 2,
  });

  it('reports health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('lists the seeded receivers', async () => {
    const res = await request(app.getHttpServer()).get('/receivers').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ password: 'nope' }).expect(401);
  });

  it('rejects tagging without a token', async () => {
    await request(app.getHttpServer()).patch(`/entities/${entityId}`).send({ name: 'No Auth' }).expect(401);
  });

  it('tags an entity with a token and reflects the change', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/entities/${entityId}`)
      .set('Authorization', auth())
      .send({ name: 'Test Subject', kind: 'person' })
      .expect(200);
    expect(res.body.status).toBe('tagged');
    expect(res.body.name).toBe('Test Subject');

    const list = await request(app.getHttpServer()).get('/entities').expect(200);
    const found = list.body.find((e: { id: string }) => e.id === entityId);
    expect(found).toBeDefined();
    expect(found.status).toBe('tagged');
  });

  it('reports a history summary', async () => {
    const res = await request(app.getHttpServer()).get('/history/summary').expect(200);
    expect(res.body).toHaveProperty('from');
    expect(res.body).toHaveProperty('to');
    expect(res.body).not.toHaveProperty('count');
  });

  it('returns history points as an array', async () => {
    const res = await request(app.getHttpServer()).get('/history?bucketMs=1000').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('refuses a window that would need more than two thousand buckets', async () => {
    await request(app.getHttpServer())
      .get('/history?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&bucketMs=500')
      .expect(400);
    await request(app.getHttpServer())
      .get('/history?from=2026-01-01T00:10:00Z&to=2026-01-01T00:00:00Z&bucketMs=500')
      .expect(400);
    await request(app.getHttpServer())
      .get('/history?from=2026-01-01T00:00:00Z&to=2026-01-01T01:00:00Z&bucketMs=3000')
      .expect(200);
  });

  it('reads and rewrites the floor plan with a token', async () => {
    const before = await request(app.getHttpServer()).get('/floorplan').expect(200);
    expect(before.body.width).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .put('/floorplan')
      .send({
        imageUrl: before.body.imageUrl,
        width: before.body.width,
        height: before.body.height,
        floor: before.body.floor,
      })
      .expect(401);
    const updated = await request(app.getHttpServer())
      .put('/floorplan')
      .set('Authorization', auth())
      .send({
        imageUrl: before.body.imageUrl,
        width: before.body.width,
        height: before.body.height,
        floor: before.body.floor,
      })
      .expect(200);
    expect(updated.body.height).toBe(before.body.height);
  });

  it('creates and deletes a receiver with a token', async () => {
    const receiver = newReceiver();
    const created = await request(app.getHttpServer())
      .post('/receivers')
      .set('Authorization', auth())
      .send({ ...receiver, floor: 0 })
      .expect(201);
    expect(created.body.id).toBe(receiver.id);
    await request(app.getHttpServer()).delete(`/receivers/${receiver.id}`).set('Authorization', auth()).expect(204);
  });

  it('answers 409 for a receiver id that is taken', async () => {
    const receiver = newReceiver();
    await request(app.getHttpServer()).post('/receivers').set('Authorization', auth()).send(receiver).expect(201);
    try {
      const duplicate = await request(app.getHttpServer())
        .post('/receivers')
        .set('Authorization', auth())
        .send(receiver)
        .expect(409);
      expect(duplicate.body.message).toBe('receiver with this id already exists');
    } finally {
      await prisma.receiver.delete({ where: { id: receiver.id } });
    }
  });

  it('answers 404 when moving or deleting a receiver that does not exist', async () => {
    const { id } = newReceiver();
    await request(app.getHttpServer())
      .patch(`/receivers/${id}`)
      .set('Authorization', auth())
      .send({ name: 'gone' })
      .expect(404);
    await request(app.getHttpServer()).delete(`/receivers/${id}`).set('Authorization', auth()).expect(404);
  });

  it('refuses a coordinate or floor that is not a usable number instead of coercing it', async () => {
    const receiver = newReceiver();
    try {
      for (const invalid of [{ floor: null }, { floor: true }, { floor: 3_000_000_000 }, { x: '' }, { x: '5' }]) {
        await request(app.getHttpServer())
          .post('/receivers')
          .set('Authorization', auth())
          .send({ ...receiver, ...invalid })
          .expect(400);
      }
      for (const invalid of [{ x: null }, { x: false }, { y: ' ' }]) {
        await request(app.getHttpServer())
          .patch(`/receivers/${receiver.id}`)
          .set('Authorization', auth())
          .send(invalid)
          .expect(400);
      }
      for (const floor of [null, 3_000_000_000]) {
        await request(app.getHttpServer())
          .put('/floorplan')
          .set('Authorization', auth())
          .send({ width: 30, height: 20, floor })
          .expect(400);
      }
    } finally {
      await prisma.receiver.deleteMany({ where: { id: receiver.id } });
    }
  });

  it('answers 404 for an entity that does not exist', async () => {
    await request(app.getHttpServer()).get(`/entities/${randomUUID()}`).expect(404).expect({
      message: 'entity not found',
      error: 'Not Found',
      statusCode: 404,
    });
  });

  it('answers 404 when tagging an entity that does not exist', async () => {
    await request(app.getHttpServer())
      .patch(`/entities/${randomUUID()}`)
      .set('Authorization', auth())
      .send({ name: 'Nobody' })
      .expect(404);
  });

  it('refuses a history window bound that is not a timestamp', async () => {
    await request(app.getHttpServer()).get('/history?from=yesterday').expect(400);
  });

  it('returns no points for a window that starts after the newest position', async () => {
    await prisma.position.create({ data: { entityId, x: 1, y: 1, accuracy: 1 } });
    try {
      await request(app.getHttpServer()).get('/history?from=2999-01-01T00:00:00Z').expect(200).expect([]);
    } finally {
      await prisma.position.deleteMany({ where: { entityId } });
    }
  });

  it('revokes a token on logout until it would have expired, drops lapsed revocations and leaves other sessions alone', async () => {
    const lapsed = { jti: randomUUID(), expiresAt: new Date(Date.now() - 1000) };
    const live = { jti: randomUUID(), expiresAt: new Date(Date.now() + 60_000) };
    await prisma.revokedToken.createMany({ data: [lapsed, live] });
    const password = app.get(ConfigService).getOrThrow<string>('ADMIN_PASSWORD');
    const login = await request(app.getHttpServer()).post('/auth/login').send({ password }).expect(201);
    const session = `Bearer ${login.body.token}`;
    const { jti, exp } = app.get(JwtService).decode<{ jti: string; exp: number }>(login.body.token);
    const jtis = [lapsed.jti, live.jti, jti];
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', session).expect(200);

    await request(app.getHttpServer()).post('/auth/logout').set('Authorization', session).expect(204);

    try {
      const refused = await request(app.getHttpServer()).get('/auth/me').set('Authorization', session).expect(401);
      expect(refused.body.message).toBe('token revoked');
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', auth()).expect(200);
      const left = await prisma.revokedToken.findMany({ where: { jti: { in: jtis } }, orderBy: { expiresAt: 'asc' } });
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
