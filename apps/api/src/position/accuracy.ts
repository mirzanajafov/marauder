import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_SCENE,
  DEFAULT_TX_POWER,
  Receiver,
  createWorld,
  seededRandom,
} from '@marauder/shared';
import { EMA_ALPHA, Tracker, TrackerOptions } from './tracker';
import { Anchor, Estimate, trilaterate, weightedCentroid } from './trilateration';

export interface Scenario {
  name: string;
  noiseDb: number;
  pathLossExponent: number;
}

export interface Variant {
  name: string;
  alpha: number;
  solve: (anchors: Anchor[]) => Estimate;
}

export interface Run {
  seed: number;
  minutes: number;
  tagCount: number;
}

export interface Errors {
  samples: number;
  median: number;
  p90: number;
  p95: number;
  walkingMedian: number;
  standingMedian: number;
  outsideFloorPct: number;
}

export const TICK_MS = 100;
export const FLUSH_MS = 150;

export function nearestReceiver(anchors: Anchor[]): Estimate {
  let best = anchors[0];
  for (const a of anchors) {
    if (a.distance < best.distance) {
      best = a;
    }
  }
  return { x: best.x, y: best.y, accuracy: best.distance };
}

export const scenarios: Scenario[] = [
  { name: 'noise 1.2 dB (simulator default)', noiseDb: 1.2, pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT },
  { name: 'noise 3 dB', noiseDb: 3, pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT },
  { name: 'noise 6 dB', noiseDb: 6, pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT },
  { name: 'noise 3 dB, building at n=3.0, solver assumes 2.5', noiseDb: 3, pathLossExponent: 3 },
];

export const variants: Variant[] = [
  { name: 'nearest receiver', alpha: 1, solve: nearestReceiver },
  { name: 'weighted centroid', alpha: 1, solve: weightedCentroid },
  { name: 'trilateration, raw', alpha: 1, solve: trilaterate },
  { name: `trilateration + EMA ${EMA_ALPHA} (live)`, alpha: EMA_ALPHA, solve: trilaterate },
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[rank];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function summarize(all: number[], walking: number[], standing: number[], outside: number): Errors {
  const sort = (values: number[]) => [...values].sort((a, b) => a - b);
  const sorted = sort(all);
  return {
    samples: all.length,
    median: round(percentile(sorted, 0.5)),
    p90: round(percentile(sorted, 0.9)),
    p95: round(percentile(sorted, 0.95)),
    walkingMedian: round(percentile(sort(walking), 0.5)),
    standingMedian: round(percentile(sort(standing), 0.5)),
    outsideFloorPct: all.length === 0 ? 0 : round((100 * outside) / all.length),
  };
}

export function measure(scenario: Scenario, list: Variant[], run: Run): Record<string, Errors> {
  const world = createWorld({
    scene: DEFAULT_SCENE,
    receivers: DEFAULT_RECEIVERS,
    tagCount: run.tagCount,
    speed: 1.4,
    noiseDb: scenario.noiseDb,
    dropProb: 0.08,
    dwellMinMs: 2500,
    dwellMaxMs: 7000,
    txPower: DEFAULT_TX_POWER,
    pathLossExponent: scenario.pathLossExponent,
    random: seededRandom(run.seed),
  });
  const receivers = new Map<string, Receiver>(DEFAULT_RECEIVERS.map((r) => [r.id, r]));
  const trackers = list.map((variant) => {
    const options: TrackerOptions = {
      pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
      alpha: variant.alpha,
      solve: variant.solve,
    };
    return {
      variant,
      tracker: new Tracker(options),
      all: [] as number[],
      walking: [] as number[],
      standing: [] as number[],
      outside: 0,
    };
  });
  const tagByFingerprint = new Map(world.tags.map((tag) => [tag.fingerprint, tag]));

  const start = 1_000_000;
  const end = start + run.minutes * 60_000;
  let nextTick = start;
  let nextFlush = start + FLUSH_MS;

  while (nextTick <= end || nextFlush <= end) {
    if (nextTick <= nextFlush) {
      world.advance(TICK_MS / 1000, nextTick);
      for (const signal of world.signals(nextTick)) {
        const entity = { id: signal.fingerprint, name: signal.fingerprint, kind: 'person', status: 'tagged' as const };
        for (const { tracker } of trackers) {
          tracker.record(entity, signal);
        }
      }
      nextTick += TICK_MS;
      continue;
    }
    for (const entry of trackers) {
      for (const update of entry.tracker.positions(nextFlush, receivers)) {
        const tag = tagByFingerprint.get(update.entityId);
        if (!tag) {
          continue;
        }
        const error = Math.hypot(update.x - tag.x, update.y - tag.y);
        entry.all.push(error);
        if (update.x < 0 || update.y < 0 || update.x > DEFAULT_SCENE.width || update.y > DEFAULT_SCENE.height) {
          entry.outside += 1;
        }
        (tag.moving ? entry.walking : entry.standing).push(error);
      }
    }
    nextFlush += FLUSH_MS;
  }

  const results: Record<string, Errors> = {};
  for (const entry of trackers) {
    results[entry.variant.name] = summarize(entry.all, entry.walking, entry.standing, entry.outside);
  }
  return results;
}
