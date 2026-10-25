import { Anchor, Estimate, residual, weightedCentroid } from '../src/position/position-fit';

export function nearestReceiver(anchors: Anchor[]): Estimate {
  const nearest = anchors.reduce((best, a) => (a.distance < best.distance ? a : best));
  return { x: nearest.x, y: nearest.y, accuracy: nearest.distance };
}

export function trilaterate(anchors: Anchor[]): Estimate {
  const ref = anchors.at(-1);
  if (!ref || anchors.length < 3) {
    return weightedCentroid(anchors);
  }
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;
  for (const a of anchors.slice(0, -1)) {
    const r0 = 2 * (a.x - ref.x);
    const r1 = 2 * (a.y - ref.y);
    const xTerm = a.x * a.x - ref.x * ref.x;
    const yTerm = a.y * a.y - ref.y * ref.y;
    const rangeTerm = ref.distance * ref.distance - a.distance * a.distance;
    const rhs = xTerm + yTerm + rangeTerm;
    const w = Math.min(a.weight, ref.weight);
    a11 += w * r0 * r0;
    a12 += w * r0 * r1;
    a22 += w * r1 * r1;
    b1 += w * r0 * rhs;
    b2 += w * r1 * rhs;
  }
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-9) {
    return weightedCentroid(anchors);
  }
  const x = (a22 * b1 - a12 * b2) / det;
  const y = (a11 * b2 - a12 * b1) / det;
  return { x, y, accuracy: residual(anchors, x, y) };
}
