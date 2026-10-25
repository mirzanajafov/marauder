import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Entity as EntityRow, Prisma } from '@prisma/client';
import { Entity } from '@marauder/shared';
import { errorMessage } from '../common/error-message';
import { ThrottledLog } from '../common/throttled-log';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { toEntityDto } from '../entities/entity.mapper';

const TOUCH_INTERVAL_MS = 10_000;

@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);
  private readonly failedTouches = new ThrottledLog(this.logger);
  private readonly lastTouch = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  async resolve(fingerprint: string): Promise<Entity> {
    const key = `fp:${fingerprint}`;
    const existingId = await this.redis.client.get(key);
    if (existingId) {
      const known = await this.load(existingId);
      if (known) {
        this.touch(existingId);
        return known;
      }
    }
    return this.createUnknown(fingerprint, key);
  }

  private async load(id: string): Promise<Entity | null> {
    const cached = await this.redis.client.get(`entity:${id}`);
    if (cached) {
      return JSON.parse(cached) as Entity;
    }
    const row = await this.prisma.entity.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    const dto = toEntityDto(row);
    await this.cache(dto);
    return dto;
  }

  private async createUnknown(fingerprint: string, key: string): Promise<Entity> {
    const id = randomUUID();
    const won = await this.redis.client.set(key, id, 'NX');
    if (won !== 'OK') {
      const winnerId = await this.redis.client.get(key);
      if (winnerId) {
        const existing = await this.load(winnerId);
        if (existing) {
          return existing;
        }
      }
    }

    let row: EntityRow;
    try {
      row = await this.prisma.entity.create({ data: { id, fingerprint, status: 'unknown' } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      const dto = toEntityDto(await this.prisma.entity.findUniqueOrThrow({ where: { fingerprint } }));
      await this.redis.client.set(key, dto.id);
      await this.cache(dto);
      return dto;
    }
    const dto = toEntityDto(row);
    await this.cache(dto);
    this.events.emit('entity.discovered', { entity: dto });
    return dto;
  }

  private async cache(entity: Entity): Promise<void> {
    await this.redis.client.set(`entity:${entity.id}`, JSON.stringify(entity));
  }

  private touch(id: string): void {
    const now = Date.now();
    const last = this.lastTouch.get(id) ?? 0;
    if (now - last < TOUCH_INTERVAL_MS) {
      return;
    }
    this.lastTouch.set(id, now);
    void this.prisma.entity
      .update({ where: { id }, data: { lastSeen: new Date(now) } })
      .then((row) => this.cache(toEntityDto(row)))
      .catch((error: unknown) => {
        this.failedTouches.failure(
          (failures) =>
            `could not update lastSeen in the database and cache (${failures} failed updates so far): ${errorMessage(error)}`,
        );
      });
  }
}
