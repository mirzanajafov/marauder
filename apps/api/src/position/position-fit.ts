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

export interface Bounds {
  width: number;
  height: number;
}

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

interface Term {
  x: number;
  y: number;
  log: number;
}

interface Guess {
  x: number;
  y: number;
  k: number;
}

const MIN_RANGE = 0.1;
const SCALE_PRIOR = 0.5;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;
const MAX_ITERATIONS = 40;

export function rssiToDistance(rssi: number, txPower: number, pathLossExponent: number): number {
  const d = Math.pow(10, (txPower - rssi) / (10 * pathLossExponent));
  return Math.min(1000, Math.max(0.1, d));
}

function centroid(anchors: Anchor[]): { x: number; y: number } {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const a of anchors) {
    sw += a.weight;
    sx += a.weight * a.x;
    sy += a.weight * a.y;
  }
  return { x: sx / sw, y: sy / sw };
}

export function weightedCentroid(anchors: Anchor[]): Estimate {
  const { x, y } = centroid(anchors);
  return { x, y, accuracy: residual(anchors, x, y) };
}

export function fitPosition(anchors: Anchor[], bounds: Bounds, fitScale = true): Estimate {
  const start = centroid(anchors);
  let guess: Guess = { x: clamp(start.x, 0, bounds.width), y: clamp(start.y, 0, bounds.height), k: 1 };
  if (anchors.length < 3) {
    return { x: guess.x, y: guess.y, accuracy: residual(anchors, guess.x, guess.y) };
  }
  const terms = anchors.map((a) => ({ x: a.x, y: a.y, log: Math.log(a.distance) }));
  const prior = fitScale && anchors.length >= 4 ? SCALE_PRIOR : null;
  let damping = 1e-3;
  let cost = logCost(terms, guess, prior);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const [h, g] = normalEquations(terms, guess, prior);
    const step = solve3(withDamping(h, damping), [-g[0], -g[1], -g[2]]);
    if (!step) {
      break;
    }
    const next: Guess = {
      x: clamp(guess.x + step[0], 0, bounds.width),
      y: clamp(guess.y + step[1], 0, bounds.height),
      k: clamp(guess.k + step[2], MIN_SCALE, MAX_SCALE),
    };
    const nextCost = logCost(terms, next, prior);
    if (nextCost < cost) {
      guess = next;
      cost = nextCost;
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

  const corrected = anchors.map((a) => ({ ...a, distance: Math.pow(a.distance, guess.k) }));
  return { x: guess.x, y: guess.y, accuracy: residual(corrected, guess.x, guess.y) };
}

function normalEquations(terms: Term[], { x, y, k }: Guess, prior: number | null): [Mat3, Vec3] {
  let h00 = 0;
  let h01 = 0;
  let h02 = 0;
  let h11 = 0;
  let h12 = 0;
  let h22 = 0;
  let g0 = 0;
  let g1 = 0;
  let g2 = 0;
  for (const term of terms) {
    const dx = x - term.x;
    const dy = y - term.y;
    const r2 = Math.max(MIN_RANGE * MIN_RANGE, dx * dx + dy * dy);
    const e = 0.5 * Math.log(r2) - k * term.log;
    const jx = dx / r2;
    const jy = dy / r2;
    const jk = prior === null ? 0 : -term.log;
    g0 += jx * e;
    g1 += jy * e;
    g2 += jk * e;
    h00 += jx * jx;
    h01 += jx * jy;
    h02 += jx * jk;
    h11 += jy * jy;
    h12 += jy * jk;
    h22 += jk * jk;
  }
  if (prior === null) {
    h22 = 1;
  } else {
    h22 += prior * prior;
    g2 += prior * prior * (k - 1);
  }
  return [
    [
      [h00, h01, h02],
      [h01, h11, h12],
      [h02, h12, h22],
    ],
    [g0, g1, g2],
  ];
}

function logCost(terms: Term[], { x, y, k }: Guess, prior: number | null): number {
  let cost = prior === null ? 0 : prior * prior * (k - 1) * (k - 1);
  for (const term of terms) {
    const e = Math.log(Math.max(MIN_RANGE, Math.hypot(x - term.x, y - term.y))) - k * term.log;
    cost += e * e;
  }
  return cost;
}

function withDamping([[a, b, c], [d, e, f], [g, h, i]]: Mat3, damping: number): Mat3 {
  const scale = 1 + damping;
  return [
    [a * scale, b, c],
    [d, e * scale, f],
    [g, h, i * scale],
  ];
}

function det3([[a, b, c], [d, e, f], [g, h, i]]: Mat3): number {
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function solve3(m: Mat3, [b0, b1, b2]: Vec3): Vec3 | null {
  const det = det3(m);
  if (Math.abs(det) < 1e-15) {
    return null;
  }
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  return [
    det3([
      [b0, b, c],
      [b1, e, f],
      [b2, h, i],
    ]) / det,
    det3([
      [a, b0, c],
      [d, b1, f],
      [g, b2, i],
    ]) / det,
    det3([
      [a, b, b0],
      [d, e, b1],
      [g, h, b2],
    ]) / det,
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function residual(anchors: Anchor[], x: number, y: number): number {
  let err = 0;
  for (const a of anchors) {
    const d = Math.hypot(x - a.x, y - a.y);
    err += (d - a.distance) * (d - a.distance);
  }
  return Math.sqrt(err / anchors.length);
}
