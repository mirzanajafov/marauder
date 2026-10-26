export const TRAIL_LENGTH = 6;
const MIN_STEP_METRES = 0.5;

export interface TrailPoint {
  x: number;
  y: number;
}

export interface Footstep extends TrailPoint {
  heading: number;
}

export function extendTrail(trail: readonly TrailPoint[], point: TrailPoint): readonly TrailPoint[] {
  const head = trail[trail.length - 1];
  if (head && Math.hypot(head.x - point.x, head.y - point.y) <= MIN_STEP_METRES) {
    return trail;
  }
  return [...trail, point].slice(-TRAIL_LENGTH);
}

export function footsteps(trail: readonly TrailPoint[]): Footstep[] {
  return trail.map((point, i) => {
    const from = trail[i - 1] ?? point;
    const to = i === 0 ? (trail[1] ?? point) : point;
    return { x: point.x, y: point.y, heading: Math.atan2(to.y - from.y, to.x - from.x) };
  });
}
