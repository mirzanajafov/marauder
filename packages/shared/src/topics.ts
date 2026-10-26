import { Entity, PositionUpdate } from './domain';

export const SIGNAL_TOPIC_WILDCARD = 'sensors/+/signals';

export const RECEIVER_ID_PATTERN = /^\w[\w.:-]{0,39}$/;

export function signalTopic(receiverId: string): string {
  return `sensors/${receiverId}/signals`;
}

export const WsEvents = {
  EntityDiscovered: 'entity.discovered',
  EntityUpdated: 'entity.updated',
  PositionsBatch: 'positions.batch',
} as const;

export interface EntityDiscoveredEvent {
  entity: Entity;
}

export interface EntityUpdatedEvent {
  entity: Entity;
}

export interface PositionsBatchEvent {
  positions: PositionUpdate[];
}
