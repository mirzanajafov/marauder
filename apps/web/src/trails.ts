export const TRAIL_LENGTH = 6;
const MIN_STEP_METRES = 0.5;

export interface TrailPoint {
  x: number;
  y: number;
}

export function extendTrail(trail: readonly TrailPoint[], point: TrailPoint): TrailPoint[] {
  const head = trail[trail.length - 1];
  if (head && Math.hypot(head.x - point.x, head.y - point.y) <= MIN_STEP_METRES) {
    return [...trail];
  }
  return [...trail, point].slice(-TRAIL_LENGTH);
}
