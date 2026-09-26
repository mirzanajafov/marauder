import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Entity } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { toEntityDto } from './entity.mapper';
import { TagEntityDto } from './dto/tag-entity.dto';

@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  async list(): Promise<Entity[]> {
    const rows = await this.prisma.entity.findMany({ orderBy: { lastSeen: 'desc' } });
    return rows.map(toEntityDto);
  }

  async get(id: string): Promise<Entity> {
    const row = await this.prisma.entity.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`entity ${id} not found`);
    }
    return toEntityDto(row);
  }

  async tag(id: string, input: TagEntityDto): Promise<Entity> {
    const exists = await this.prisma.entity.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`entity ${id} not found`);
    }
    const row = await this.prisma.entity.update({
      where: { id },
      data: { name: input.name, kind: input.kind ?? null, status: 'tagged' },
    });
    const dto = toEntityDto(row);
    await this.redis.client.set(`entity:${dto.id}`, JSON.stringify(dto));
    this.events.emit('entity.updated', { entity: dto });
    return dto;
  }
}
