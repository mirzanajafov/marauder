import { HistoryPoint } from '@marauder/shared';
import { TRAIL_LENGTH, TrailPoint, extendTrail } from './trails';

const FRAMES = 1200;
const MIN_BUCKET_MS = 500;

export const WINDOWS = [
  { label: '10 min', ms: 10 * 60_000 },
  { label: '1 h', ms: 60 * 60_000 },
] as const;

export interface Frame {
  time: number;
  points: Record<string, HistoryPoint>;
}

export function bucketFor(windowMs: number): number {
  return Math.max(MIN_BUCKET_MS, Math.ceil(windowMs / FRAMES));
}

export function buildFrames(points: readonly HistoryPoint[]): Frame[] {
  const byTime = new Map<number, HistoryPoint[]>();
  for (const point of points) {
    const bucket = byTime.get(point.time);
    if (bucket) {
      bucket.push(point);
    } else {
      byTime.set(point.time, [point]);
    }
  }
  const latest: Record<string, HistoryPoint> = {};
  return [...byTime.keys()]
    .sort((a, b) => a - b)
    .map((time) => {
      for (const point of byTime.get(time) ?? []) {
        latest[point.entityId] = point;
      }
      return { time, points: { ...latest } };
    });
}

export function trailsAt(frames: readonly Frame[], index: number): Record<string, TrailPoint[]> {
  const trails: Record<string, TrailPoint[]> = {};
  for (const frame of frames.slice(Math.max(0, index - TRAIL_LENGTH + 1), index + 1)) {
    for (const point of Object.values(frame.points)) {
      trails[point.entityId] = extendTrail(trails[point.entityId] ?? [], { x: point.x, y: point.y });
    }
  }
  return trails;
}
