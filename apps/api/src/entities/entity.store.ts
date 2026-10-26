import { Injectable } from '@nestjs/common';
import { Entity as EntityRow } from '@prisma/client';
import { Entity, TagEntityInput } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

function toEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    name: row.name,
    kind: row.kind,
    status: row.status,
    firstSeen: row.firstSeen.getTime(),
    lastSeen: row.lastSeen.getTime(),
  };
}

const CACHE_TTL_SECONDS = 60;

function cacheKey(fingerprint: string): string {
  return `fingerprint:${fingerprint}`;
}

@Injectable()
export class EntityStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(): Promise<Entity[]> {
    const rows = await this.prisma.entity.findMany({ orderBy: { lastSeen: 'desc' } });
    return rows.map(toEntity);
  }

  async get(id: string): Promise<Entity | null> {
    const row = await this.prisma.entity.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByFingerprint(fingerprint: string): Promise<Entity | null> {
    const cached = await this.redis.client.get(cacheKey(fingerprint));
    if (cached) {
      return JSON.parse(cached) as Entity;
    }
    const row = await this.prisma.entity.findUnique({ where: { fingerprint } });
    if (!row) {
      return null;
    }
    const entity = toEntity(row);
    await this.redis.client.set(cacheKey(fingerprint), JSON.stringify(entity), 'EX', CACHE_TTL_SECONDS, 'NX');
    return entity;
  }

  async createUnknown(fingerprint: string): Promise<{ entity: Entity; created: boolean }> {
    const inserted = await this.prisma.entity.createManyAndReturn({ data: [{ fingerprint }], skipDuplicates: true });
    const insertedRow = inserted.at(0);
    if (insertedRow) {
      return { entity: toEntity(insertedRow), created: true };
    }
    const row = await this.prisma.entity.findUniqueOrThrow({ where: { fingerprint } });
    return { entity: toEntity(row), created: false };
  }

  async tag(id: string, input: TagEntityInput): Promise<Entity> {
    const row = await this.prisma.entity.update({
      where: { id },
      data: { name: input.name, kind: input.kind, status: 'tagged' },
    });
    const entity = toEntity(row);
    await this.redis.client.set(cacheKey(row.fingerprint), JSON.stringify(entity), 'EX', CACHE_TTL_SECONDS);
    return entity;
  }

  async markSeen(id: string, at: Date): Promise<void> {
    await this.prisma.entity.update({ where: { id }, data: { lastSeen: at } });
  }
}
