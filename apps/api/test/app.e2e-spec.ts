import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let entityId: string;
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
  });

  afterAll(async () => {
    if (prisma && entityId) {
      await prisma.entity.delete({ where: { id: entityId } }).catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
  });

  it('reports health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('lists the seeded receivers', async () => {
    const res = await request(app.getHttpServer()).get('/receivers').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
  });

  it('tags an entity and reflects the change', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/entities/${entityId}`)
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
    expect(typeof res.body.count).toBe('number');
  });

  it('returns history points as an array', async () => {
    const res = await request(app.getHttpServer()).get('/history?bucketMs=1000').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('reads and rewrites the floor plan', async () => {
    const before = await request(app.getHttpServer()).get('/floorplan').expect(200);
    expect(before.body.width).toBeGreaterThan(0);
    const updated = await request(app.getHttpServer())
      .put('/floorplan')
      .send({ imageUrl: before.body.imageUrl, width: before.body.width, height: before.body.height, floor: before.body.floor })
      .expect(200);
    expect(updated.body.height).toBe(before.body.height);
  });

  it('creates and deletes a receiver', async () => {
    const id = 'e2e-rx-' + Date.now();
    const created = await request(app.getHttpServer())
      .post('/receivers')
      .send({ id, name: 'E2E', x: 1, y: 2, floor: 0 })
      .expect(201);
    expect(created.body.id).toBe(id);
    await request(app.getHttpServer()).delete('/receivers/' + id).expect(204);
  });
});
