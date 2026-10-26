import { PositionUpdate } from '@marauder/shared';
import { TrailPoint, extendTrail } from './trails';

export const QUIET_TRACK_MS = 5_000;

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
      trail: extendTrail(tracks[position.entityId]?.trail ?? [], position),
      heardAt: now,
    };
  }
  return next;
}

export function dropQuietTracks(tracks: Tracks, now: number): Tracks {
  const active = Object.entries(tracks).filter(([, track]) => now - track.heardAt <= QUIET_TRACK_MS);
  return active.length === Object.keys(tracks).length ? tracks : Object.fromEntries(active);
}
