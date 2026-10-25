import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Entity } from '@marauder/shared';
import { ResolutionService } from './resolution.service';

interface Mocks {
  prisma: any;
  redis: any;
  events: any;
}

function entityRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'id1',
    fingerprint: 'tag-01',
    name: null,
    kind: null,
    status: 'unknown',
    firstSeen: new Date(1000),
    lastSeen: new Date(2000),
    ...over,
  };
}

function build(): { service: ResolutionService } & Mocks {
  const prisma = {
    entity: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(entityRow()),
    },
  };
  const redis = { client: { get: jest.fn(), set: jest.fn() } };
  const events = { emit: jest.fn() };
  const service = new ResolutionService(prisma as any, redis as any, events as any);
  return { service, prisma, redis, events };
}

describe('ResolutionService', () => {
  it('returns a cached entity without creating a new one', async () => {
    const { service, redis, prisma, events } = build();
    const cached: Entity = {
      id: 'id1',
      fingerprint: 'tag-01',
      name: 'Neo',
      kind: 'person',
      status: 'tagged',
      firstSeen: 1000,
      lastSeen: 2000,
    };
    redis.client.get.mockImplementation(async (key: string) => {
      if (key === 'fp:tag-01') return 'id1';
      if (key === 'entity:id1') return JSON.stringify(cached);
      return null;
    });

    const result = await service.resolve('tag-01');

    expect(result).toEqual(cached);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('creates an unknown entity on first sighting and announces it', async () => {
    const { service, redis, prisma, events } = build();
    redis.client.get.mockResolvedValue(null);
    redis.client.set.mockResolvedValue('OK');
    prisma.entity.create.mockResolvedValue(entityRow());

    const result = await service.resolve('tag-01');

    expect(result.status).toBe('unknown');
    expect(result.fingerprint).toBe('tag-01');
    expect(redis.client.set).toHaveBeenCalledWith('fp:tag-01', expect.any(String), 'NX');
    expect(events.emit).toHaveBeenCalledWith('entity.discovered', expect.objectContaining({ entity: result }));
  });

  it('does not duplicate when it loses the creation race', async () => {
    const { service, redis, prisma, events } = build();
    const winner: Entity = {
      id: 'winner',
      fingerprint: 'tag-01',
      name: null,
      kind: null,
      status: 'unknown',
      firstSeen: 1000,
      lastSeen: 2000,
    };
    redis.client.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('winner')
      .mockResolvedValueOnce(JSON.stringify(winner));
    redis.client.set.mockResolvedValue(null);

    const result = await service.resolve('tag-01');

    expect(result).toEqual(winner);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('returns the stored entity when the insert hits the unique fingerprint', async () => {
    const { service, redis, prisma, events } = build();
    redis.client.get.mockResolvedValue(null);
    redis.client.set.mockResolvedValue('OK');
    prisma.entity.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: Prisma.prismaVersion.client }),
    );
    prisma.entity.findUniqueOrThrow.mockResolvedValue(entityRow({ id: 'stored' }));

    const result = await service.resolve('tag-01');

    expect(result.id).toBe('stored');
    expect(prisma.entity.findUniqueOrThrow).toHaveBeenCalledWith({ where: { fingerprint: 'tag-01' } });
    expect(redis.client.set).toHaveBeenCalledWith('fp:tag-01', 'stored');
    expect(redis.client.set).toHaveBeenCalledWith('entity:stored', expect.stringContaining('"id":"stored"'));
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('passes a database failure on instead of treating it as a lost race', async () => {
    const { service, redis, prisma } = build();
    redis.client.get.mockResolvedValue(null);
    redis.client.set.mockResolvedValue('OK');
    prisma.entity.create.mockRejectedValue(new Error('connection refused'));

    await expect(service.resolve('tag-01')).rejects.toThrow('connection refused');
  });

  it('logs when it cannot record that a known entity was seen', async () => {
    const { service, redis, prisma } = build();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    redis.client.get.mockImplementation(async (key: string) => {
      if (key === 'fp:tag-01') return 'id1';
      if (key === 'entity:id1') return JSON.stringify({ id: 'id1', fingerprint: 'tag-01', status: 'unknown' });
      return null;
    });
    prisma.entity.update.mockRejectedValue(new Error('connection refused'));

    await service.resolve('tag-01');
    await new Promise((resolve) => setImmediate(resolve));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('id1'));
    expect(warn.mock.calls[0][0]).toContain('connection refused');
  });
});
