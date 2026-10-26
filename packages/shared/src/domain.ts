export type EntityStatus = 'unknown' | 'tagged';

export interface SignalPayload {
  fingerprint: string;
  receiverId: string;
  rssi: number;
  txPower: number;
}

export interface ReceivedSignal extends SignalPayload {
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

export interface PositionUpdate {
  entityId: string;
  x: number;
  y: number;
  accuracy: number;
  ts: number;
}

export interface TagEntityInput {
  name: string;
  kind?: string;
}

export const MAX_POSITION_FLUSH_MS = 2_000;

export const MAX_HISTORY_BUCKETS = 2_000;
export const MIN_HISTORY_BUCKET_MS = 100;
export const MAX_HISTORY_BUCKET_MS = 10_000;

export interface HistorySummary {
  from: string | null;
  to: string | null;
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
