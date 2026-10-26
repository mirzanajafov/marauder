import { Entity, MAX_POSITION_FLUSH_MS, PositionUpdate } from '@marauder/shared';
import { Marker } from './FloorMap';
import { TrailPoint, extendTrail } from './trails';

const LATE_BATCH_MS = 1_000;
export const QUIET_TRACK_MS = 2 * MAX_POSITION_FLUSH_MS + LATE_BATCH_MS;

export interface Track {
  position: PositionUpdate;
  trail: readonly TrailPoint[];
  heardAt: number;
}

export type Tracks = Readonly<Record<string, Track>>;

export function applyPositions(tracks: Tracks, positions: readonly PositionUpdate[], now: number): Tracks {
  const next = { ...tracks };
  for (const position of positions) {
    next[position.entityId] = {
      position,
      trail: extendTrail(next[position.entityId]?.trail ?? [], position),
      heardAt: now,
    };
  }
  return next;
}

export function dropQuietTracks(tracks: Tracks, now: number): Tracks {
  const active = Object.entries(tracks).filter(([, track]) => now - track.heardAt <= QUIET_TRACK_MS);
  return active.length === Object.keys(tracks).length ? tracks : Object.fromEntries(active);
}

export function toMarkers(tracks: Tracks, entities: Readonly<Record<string, Entity>>): Marker[] {
  return Object.values(tracks).map(({ position, trail }) => ({
    id: position.entityId,
    x: position.x,
    y: position.y,
    label: entities[position.entityId]?.name ?? 'Unknown',
    trail,
  }));
}
