export interface Anchor {
  x: number;
  y: number;
  distance: number;
  weight: number;
}

export interface Estimate {
  x: number;
  y: number;
  accuracy: number;
}

export function rssiToDistance(rssi: number, txPower: number, pathLossExponent: number): number {
  const d = Math.pow(10, (txPower - rssi) / (10 * pathLossExponent));
  return Math.min(1000, Math.max(0.1, d));
}

export function weightedCentroid(anchors: Anchor[]): Estimate {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const a of anchors) {
    sw += a.weight;
    sx += a.weight * a.x;
    sy += a.weight * a.y;
  }
  if (sw === 0) {
    return { x: 0, y: 0, accuracy: Number.POSITIVE_INFINITY };
  }
  const x = sx / sw;
  const y = sy / sw;
  return { x, y, accuracy: residual(anchors, x, y) };
}

export function trilaterate(anchors: Anchor[]): Estimate {
  if (anchors.length < 3) {
    return weightedCentroid(anchors);
  }
  const ref = anchors[anchors.length - 1];
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const r0 = 2 * (a.x - ref.x);
    const r1 = 2 * (a.y - ref.y);
    const rhs =
      a.x * a.x - ref.x * ref.x +
      (a.y * a.y - ref.y * ref.y) +
      (ref.distance * ref.distance - a.distance * a.distance);
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

function residual(anchors: Anchor[], x: number, y: number): number {
  let err = 0;
  for (const a of anchors) {
    const d = Math.hypot(x - a.x, y - a.y);
    err += (d - a.distance) * (d - a.distance);
  }
  return Math.sqrt(err / anchors.length);
}
