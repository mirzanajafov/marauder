import { Entity, PositionUpdate, RawSignal, Receiver } from '@marauder/shared';
import { Anchor, Estimate, rssiToDistance } from './trilateration';

interface Reading {
  rssi: number;
  distance: number;
  weight: number;
  ts: number;
}

interface Track {
  readings: Map<string, Reading>;
  smoothed: { x: number; y: number } | null;
  lastReadingTs: number;
  name: string | null;
  kind: string | null;
  status: Entity['status'];
}

export const STALE_READING_MS = 3_000;
export const DROP_TRACK_MS = 12_000;
export const POSITION_ALPHA = 0.3;
export const RSSI_ALPHA = 0.2;

export type TrackedEntity = Pick<Entity, 'id' | 'name' | 'kind' | 'status'>;

export interface TrackerOptions {
  pathLossExponent: number;
  alpha: number;
  rssiAlpha: number;
  solve: (anchors: Anchor[]) => Estimate;
}

export class Tracker {
  private readonly tracks = new Map<string, Track>();

  constructor(private readonly options: TrackerOptions) {}

  get size(): number {
    return this.tracks.size;
  }

  record(entity: TrackedEntity, signal: RawSignal): void {
    let track = this.tracks.get(entity.id);
    if (!track) {
      track = {
        readings: new Map(),
        smoothed: null,
        lastReadingTs: signal.ts,
        name: entity.name,
        kind: entity.kind,
        status: entity.status,
      };
      this.tracks.set(entity.id, track);
    }
    track.name = entity.name;
    track.kind = entity.kind;
    track.status = entity.status;
    track.lastReadingTs = Math.max(track.lastReadingTs, signal.ts);
    const previous = track.readings.get(signal.receiverId);
    const beta = this.options.rssiAlpha;
    const rssi =
      previous && signal.ts - previous.ts <= STALE_READING_MS
        ? beta * signal.rssi + (1 - beta) * previous.rssi
        : signal.rssi;
    const distance = rssiToDistance(rssi, signal.txPower, this.options.pathLossExponent);
    track.readings.set(signal.receiverId, {
      rssi,
      distance,
      weight: 1 / (distance * distance + 1),
      ts: signal.ts,
    });
  }

  positions(now: number, receivers: Map<string, Receiver>): PositionUpdate[] {
    const updates: PositionUpdate[] = [];
    const alpha = this.options.alpha;

    for (const [entityId, track] of this.tracks) {
      if (now - track.lastReadingTs > DROP_TRACK_MS) {
        this.tracks.delete(entityId);
        continue;
      }

      const anchors: Anchor[] = [];
      for (const [receiverId, reading] of track.readings) {
        if (now - reading.ts > STALE_READING_MS) {
          track.readings.delete(receiverId);
          continue;
        }
        const receiver = receivers.get(receiverId);
        if (!receiver) {
          continue;
        }
        anchors.push({ x: receiver.x, y: receiver.y, distance: reading.distance, weight: reading.weight });
      }

      if (anchors.length === 0) {
        continue;
      }

      const estimate = this.options.solve(anchors);
      const smoothed = track.smoothed
        ? {
            x: alpha * estimate.x + (1 - alpha) * track.smoothed.x,
            y: alpha * estimate.y + (1 - alpha) * track.smoothed.y,
          }
        : { x: estimate.x, y: estimate.y };
      track.smoothed = smoothed;

      updates.push({
        entityId,
        x: smoothed.x,
        y: smoothed.y,
        accuracy: estimate.accuracy,
        ts: now,
        name: track.name,
        status: track.status,
        kind: track.kind,
      });
    }

    return updates;
  }
}
