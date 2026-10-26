import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Entity, EntityUpdatedEvent, WsEvents } from '@marauder/shared';
import { TagEntityDto } from './dto/tag-entity.dto';
import { EntityStore } from './entity.store';

@Injectable()
export class EntitiesService {
  constructor(
    private readonly store: EntityStore,
    private readonly events: EventEmitter2,
  ) {}

  list(): Promise<Entity[]> {
    return this.store.list();
  }

  async get(id: string): Promise<Entity> {
    const entity = await this.store.get(id);
    if (!entity) {
      throw new NotFoundException('entity not found');
    }
    return entity;
  }

  async tag(id: string, input: TagEntityDto): Promise<Entity> {
    const entity = await this.store.tag(id, input);
    this.events.emit(WsEvents.EntityUpdated, { entity } satisfies EntityUpdatedEvent);
    return entity;
  }
}
