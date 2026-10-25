import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Entity as EntityRow, Prisma } from '@prisma/client';
import { EntitiesService } from '../src/entities/entities.service';
import { EntityStore } from '../src/entities/entity.store';
import { ResolutionService } from '../src/entities/resolution.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

type Where = { id: string } | { fingerprint: string };

function prismaError(code: string, message: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: Prisma.prismaVersion.client });
}

class FakeRedis {
  readonly values = new Map<string, { value: string; expiresAt: number }>();

  get(key: string): Promise<string | null> {
    const entry = this.values.get(key);
    return Promise.resolve(entry && entry.expiresAt > Date.now() ? entry.value : null);
  }

  set(key: string, value: string, _mode: 'EX', seconds: number): Promise<'OK'> {
    this.values.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }
}

class FakeEntityTable {
  readonly rows: EntityRow[] = [];

  readonly findUnique = jest.fn(({ where }: { where: Where }) => Promise.resolve(this.find(where) ?? null));

  readonly findUniqueOrThrow = jest.fn(({ where }: { where: Where }) => {
    const row = this.find(where);
    return row ? Promise.resolve(row) : Promise.reject(prismaError('P2025', 'No Entity found'));
  });

  readonly createManyAndReturn = jest.fn(
    ({ data, skipDuplicates }: { data: { id: string; fingerprint: string }[]; skipDuplicates: boolean }) => {
      const fresh = data.filter(({ fingerprint }) => !this.find({ fingerprint }));
      if (fresh.length < data.length && !skipDuplicates) {
        return Promise.reject(prismaError('P2002', 'Unique constraint failed on the fields: (`fingerprint`)'));
      }
      const now = new Date();
      const inserted: EntityRow[] = fresh.map(({ id, fingerprint }) => ({
        id,
        fingerprint,
        name: null,
        kind: null,
        status: 'unknown',
        firstSeen: now,
        lastSeen: now,
      }));
      this.rows.push(...inserted);
      return Promise.resolve(inserted);
    },
  );

  readonly update = jest.fn(({ where, data }: { where: { id: string }; data: Partial<EntityRow> }) => {
    const row = this.find(where);
    if (!row) {
      return Promise.reject(prismaError('P2025', 'Record to update not found.'));
    }
    Object.assign(row, Object.fromEntries(Object.entries<unknown>(data).filter(([, value]) => value !== undefined)));
    return Promise.resolve({ ...row });
  });

  private find(where: Where): EntityRow | undefined {
    return this.rows.find((row) => ('id' in where ? row.id === where.id : row.fingerprint === where.fingerprint));
  }
}

export async function entitiesTestingModule() {
  const table = new FakeEntityTable();
  const redis = new FakeRedis();
  const emit = jest.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      EntitiesService,
      ResolutionService,
      EntityStore,
      { provide: PrismaService, useValue: { entity: table } },
      { provide: RedisService, useValue: { client: redis } },
      { provide: EventEmitter2, useValue: { emit } },
    ],
  }).compile();
  return {
    entities: moduleRef.get(EntitiesService),
    resolution: moduleRef.get(ResolutionService),
    table,
    redis,
    emit,
  };
}
