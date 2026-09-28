export type EntityStatus = 'unknown' | 'tagged';

export interface RawSignal {
  fingerprint: string;
  receiverId: string;
  rssi: number;
  txPower: number;
  ts: number;
}

export interface Receiver {
  id: string;
  name: string;
  x: number;
  y: number;
  floor: number;
}

export interface Entity {
  id: string;
  fingerprint: string;
  name: string | null;
  kind: string | null;
  status: EntityStatus;
  firstSeen: number;
  lastSeen: number;
}

export interface Position {
  entityId: string;
  x: number;
  y: number;
  accuracy: number;
  ts: number;
}

export interface PositionUpdate extends Position {
  name: string | null;
  status: EntityStatus;
  kind: string | null;
}

export const SIGNAL_TOPIC_WILDCARD = 'sensors/+/signals';

export function signalTopic(receiverId: string): string {
  return `sensors/${receiverId}/signals`;
}

export function receiverIdFromTopic(topic: string): string | null {
  const parts = topic.split('/');
  if (parts.length === 3 && parts[0] === 'sensors' && parts[2] === 'signals') {
    return parts[1];
  }
  return null;
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

export interface TagEntityInput {
  name: string;
  kind?: string;
}

export const FLOOR = { width: 40, height: 25 };

export const DEFAULT_RECEIVERS: Receiver[] = [
  { id: 'R1', name: 'NW', x: 0, y: 0, floor: 0 },
  { id: 'R2', name: 'NE', x: 40, y: 0, floor: 0 },
  { id: 'R3', name: 'SW', x: 0, y: 25, floor: 0 },
  { id: 'R4', name: 'SE', x: 40, y: 25, floor: 0 },
  { id: 'R5', name: 'C', x: 20, y: 12.5, floor: 0 },
];

export const DEFAULT_TX_POWER = -59;
export const DEFAULT_PATH_LOSS_EXPONENT = 2.5;

export interface HistorySummary {
  from: string | null;
  to: string | null;
  count: number;
}

export interface HistoryPoint {
  entityId: string;
  x: number;
  y: number;
  accuracy: number;
  time: number;
  name: string | null;
  status: EntityStatus;
}

export interface FloorPlan {
  imageUrl: string | null;
  width: number;
  height: number;
  floor: number;
}

export const DEFAULT_FLOORPLAN_ID = 'default';
