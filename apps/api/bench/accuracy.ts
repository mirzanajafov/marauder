import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_SCENE,
  DEFAULT_SIM_HZ,
  DEFAULT_TRAFFIC,
  Receiver,
  WorldOptions,
  createDefaultWorld,
  seededRandom,
  tickMs,
} from '@marauder/shared';
import { DEFAULT_POSITION_FLUSH_MS } from '../src/config/env.validation';
import { Anchor, Estimate, fitPosition, weightedCentroid } from '../src/position/position-fit';
import { POSITION_ALPHA, RSSI_ALPHA, Tracker, TrackerOptions } from '../src/position/tracker';
import { nearestReceiver, trilaterate } from './baselines';

export interface Scenario {
  name: string;
  noiseDb: number;
  pathLossExponent: number;
  receiverBiasDb?: number;
}

export interface Variant {
  name: string;
  alpha: number;
  rssiAlpha: number;
  solve: (anchors: Anchor[]) => Estimate;
}

export interface Run {
  seed: number;
  minutes: number;
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

const TICK_MS = tickMs(DEFAULT_SIM_HZ);

export const scenarios = {
  simulatorDefault: {
    name: `noise ${DEFAULT_TRAFFIC.noiseDb} dB (simulator default)`,
    noiseDb: DEFAULT_TRAFFIC.noiseDb,
    pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
  },
  noise3: { name: 'noise 3 dB', noiseDb: 3, pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT },
  noise6: { name: 'noise 6 dB', noiseDb: 6, pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT },
  wrongExponent: { name: 'noise 3 dB, building at n=3.0, solver assumes 2.5', noiseDb: 3, pathLossExponent: 3 },
  receiverOffsets: {
    name: 'noise 3 dB, each receiver off by a fixed offset (sd 3 dB)',
    noiseDb: 3,
    pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
    receiverBiasDb: 3,
  },
} satisfies Record<string, Scenario>;

const floor = { width: DEFAULT_SCENE.width, height: DEFAULT_SCENE.height };

export const variants = {
  nearest: { name: 'nearest receiver', alpha: 1, rssiAlpha: 1, solve: nearestReceiver },
  centroid: { name: 'weighted centroid', alpha: 1, rssiAlpha: 1, solve: weightedCentroid },
  rawTrilateration: { name: 'trilateration, raw', alpha: 1, rssiAlpha: 1, solve: trilaterate },
  before: { name: 'trilateration + EMA 0.18 (before)', alpha: 0.18, rssiAlpha: 1, solve: trilaterate },
  fixedExponentFit: {
    name: 'log-distance fit, fixed exponent + EMA 0.18',
    alpha: 0.18,
    rssiAlpha: 1,
    solve: (anchors) => fitPosition(anchors, floor, false),
  },
  smoothedFixedExponentFit: {
    name: `RSSI EMA ${RSSI_ALPHA} + log-distance fit, fixed exponent + EMA ${POSITION_ALPHA}`,
    alpha: POSITION_ALPHA,
    rssiAlpha: RSSI_ALPHA,
    solve: (anchors) => fitPosition(anchors, floor, false),
  },
  live: {
    name: `RSSI EMA ${RSSI_ALPHA} + log-distance fit with scale + EMA ${POSITION_ALPHA} (live)`,
    alpha: POSITION_ALPHA,
    rssiAlpha: RSSI_ALPHA,
    solve: (anchors) => fitPosition(anchors, floor),
  },
} satisfies Record<string, Variant>;

function percentile(sorted: number[], p: number): number {
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[rank] ?? Number.NaN;
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

export function worldFor({
  noiseDb,
  pathLossExponent,
  receiverBiasDb,
}: Scenario): Omit<WorldOptions, 'scene' | 'receivers' | 'txPower' | 'random'> {
  return { ...DEFAULT_TRAFFIC, noiseDb, pathLossExponent, receiverBiasDb };
}

export function measure(scenario: Scenario, list: Variant[], run: Run): Record<string, Errors> {
  const world = createDefaultWorld({ ...worldFor(scenario), random: seededRandom(run.seed) });
  const receivers = new Map<string, Receiver>(DEFAULT_RECEIVERS.map((r) => [r.id, r]));
  const trackers = list.map((variant) => {
    const options: TrackerOptions = {
      pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
      alpha: variant.alpha,
      rssiAlpha: variant.rssiAlpha,
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
  let nextFlush = start + DEFAULT_POSITION_FLUSH_MS;

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
      for (const update of entry.tracker.advance(nextFlush, receivers)) {
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
    nextFlush += DEFAULT_POSITION_FLUSH_MS;
  }

  const results: Record<string, Errors> = {};
  for (const entry of trackers) {
    results[entry.variant.name] = summarize(entry.all, entry.walking, entry.standing, entry.outside);
  }
  return results;
}
