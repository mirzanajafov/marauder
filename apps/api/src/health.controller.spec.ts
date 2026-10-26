import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { IngestService } from './ingest/ingest.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

async function health({ database = true, redis = 'ready', mqtt = true } = {}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: PrismaService,
        useValue: { $queryRaw: () => (database ? Promise.resolve([]) : Promise.reject(new Error('down'))) },
      },
      { provide: RedisService, useValue: { client: { status: redis } } },
      { provide: IngestService, useValue: { connected: mqtt } },
    ],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok when the database, Redis and the broker are all reachable', async () => {
    await expect((await health()).check()).resolves.toEqual({
      status: 'ok',
      checks: { database: true, redis: true, mqtt: true },
    });
  });

  it.each([
    ['the database', { database: false }, { database: false, redis: true, mqtt: true }],
    ['Redis', { redis: 'reconnecting' }, { database: true, redis: false, mqtt: true }],
    ['the broker', { mqtt: false }, { database: true, redis: true, mqtt: false }],
  ])('answers 503 and names what is down when %s is unreachable', async (_name, down, checks) => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect((await health(down)).check()).rejects.toMatchObject({
      status: 503,
      response: { status: 'down', checks },
    });
  });
});
