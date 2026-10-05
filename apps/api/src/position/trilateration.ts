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

export interface Bounds {
  width: number;
  height: number;
}

const MIN_RANGE = 0.1;
const SCALE_PRIOR = 0.5;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;
const MAX_ITERATIONS = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function solve3(m: number[][], b: number[]): number[] | null {
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  if (Math.abs(det) < 1e-15) {
    return null;
  }
  const column = (i: number) => m.map((row, r) => row.map((value, c) => (c === i ? b[r] : value)));
  const minor = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  return [0, 1, 2].map((i) => minor(column(i)) / det);
}

function logCost(anchors: Anchor[], logs: number[], x: number, y: number, k: number, prior: number): number {
  let cost = prior * prior * (k - 1) * (k - 1);
  anchors.forEach((a, i) => {
    const e = Math.log(Math.max(MIN_RANGE, Math.hypot(x - a.x, y - a.y))) - k * logs[i];
    cost += e * e;
  });
  return cost;
}

export function fitPosition(anchors: Anchor[], bounds: Bounds, fitScale = true): Estimate {
  const start = weightedCentroid(anchors);
  let x = clamp(start.x, 0, bounds.width);
  let y = clamp(start.y, 0, bounds.height);
  if (anchors.length < 3) {
    return { x, y, accuracy: start.accuracy };
  }
  const logs = anchors.map((a) => Math.log(a.distance));
  const scaled = fitScale && anchors.length >= 4;
  const prior = scaled ? SCALE_PRIOR : 0;
  let k = 1;
  let damping = 1e-3;
  let cost = logCost(anchors, logs, x, y, k, prior);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const h = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const g = [0, 0, 0];
    anchors.forEach((a, i) => {
      const dx = x - a.x;
      const dy = y - a.y;
      const r2 = Math.max(MIN_RANGE * MIN_RANGE, dx * dx + dy * dy);
      const e = 0.5 * Math.log(r2) - k * logs[i];
      const j = [dx / r2, dy / r2, scaled ? -logs[i] : 0];
      for (let p = 0; p < 3; p++) {
        g[p] += j[p] * e;
        for (let q = 0; q < 3; q++) {
          h[p][q] += j[p] * j[q];
        }
      }
    });
    if (scaled) {
      h[2][2] += prior * prior;
      g[2] += prior * prior * (k - 1);
    } else {
      h[2][2] = 1;
    }
    const damped = h.map((row, p) => row.map((value, q) => (p === q ? value * (1 + damping) : value)));
    const step = solve3(damped, g.map((value) => -value));
    if (!step) {
      break;
    }
    const nx = clamp(x + step[0], 0, bounds.width);
    const ny = clamp(y + step[1], 0, bounds.height);
    const nk = clamp(k + step[2], MIN_SCALE, MAX_SCALE);
    const next = logCost(anchors, logs, nx, ny, nk, prior);
    if (next < cost) {
      x = nx;
      y = ny;
      k = nk;
      cost = next;
      damping = Math.max(1e-6, damping / 3);
      if (Math.hypot(step[0], step[1]) < 1e-3 && Math.abs(step[2]) < 1e-4) {
        break;
      }
    } else {
      damping *= 4;
      if (damping > 1e6) {
        break;
      }
    }
  }

  const corrected = anchors.map((a) => ({ ...a, distance: Math.pow(a.distance, k) }));
  return { x, y, accuracy: residual(corrected, x, y) };
}

function residual(anchors: Anchor[], x: number, y: number): number {
  let err = 0;
  for (const a of anchors) {
    const d = Math.hypot(x - a.x, y - a.y);
    err += (d - a.distance) * (d - a.distance);
  }
  return Math.sqrt(err / anchors.length);
}
