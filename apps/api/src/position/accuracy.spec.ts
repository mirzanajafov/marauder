import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_SCENE,
  DEFAULT_TX_POWER,
  createWorld,
  seededRandom,
} from '@marauder/shared';
import { measure, scenarios, variants } from './accuracy';

function world(dropProb: number, seed: number) {
  return createWorld({
    scene: DEFAULT_SCENE,
    receivers: DEFAULT_RECEIVERS,
    tagCount: 6,
    speed: 1.4,
    noiseDb: 1.2,
    dropProb,
    dwellMinMs: 2500,
    dwellMaxMs: 7000,
    txPower: DEFAULT_TX_POWER,
    pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
    random: seededRandom(seed),
  });
}

describe('simulated world', () => {
  it('replays the same walk for the same seed', () => {
    const a = world(0.08, 11);
    const b = world(0.08, 11);
    for (let t = 0; t < 600; t++) {
      a.advance(0.1, t * 100);
      b.advance(0.1, t * 100);
    }
    expect(a.tags).toEqual(b.tags);
    expect(a.signals(60_000)).toEqual(b.signals(60_000));
  });

  it('keeps every tag on the floor and hears it from every receiver when nothing drops', () => {
    const w = world(0, 5);
    let offFloor = 0;
    for (let t = 0; t < 3000; t++) {
      w.advance(0.1, t * 100);
      for (const tag of w.tags) {
        if (tag.x < 0 || tag.y < 0 || tag.x > DEFAULT_SCENE.width || tag.y > DEFAULT_SCENE.height) {
          offFloor += 1;
        }
      }
    }
    expect(offFloor).toBe(0);
    expect(w.signals(300_000)).toHaveLength(6 * DEFAULT_RECEIVERS.length);
  });
});

describe('accuracy benchmark', () => {
  const before = variants.find((variant) => variant.name.includes('(before)'));
  const live = variants.find((variant) => variant.name.includes('(live)'));
  if (!before || !live) {
    throw new Error('the benchmark lost its before or live variant');
  }
  const pair = [before, live];
  const quick = { seed: 3, minutes: 2, tagCount: 6 };
  const scenario = (text: string) => {
    const found = scenarios.find((candidate) => candidate.name.includes(text));
    if (!found) {
      throw new Error(`no scenario matching ${text}`);
    }
    return found;
  };

  it('gives the same numbers for the same seed', () => {
    const once = { ...quick, minutes: 1 };
    expect(measure(scenarios[0], [live], once)).toEqual(measure(scenarios[0], [live], once));
  });

  it('stays about a metre off at the simulator default noise', () => {
    const results = measure(scenario('simulator default'), pair, quick);
    expect(results[live.name].samples).toBeGreaterThan(4000);
    expect(results[live.name].median).toBeLessThan(1.3);
    expect(results[live.name].p95).toBeLessThan(results[before.name].p95);
  });

  it('cuts the error under heavy noise', () => {
    const results = measure(scenario('6 dB'), pair, quick);
    expect(results[live.name].median).toBeLessThan(0.75 * results[before.name].median);
  });

  it('keeps a wrong path-loss exponent from throwing dots out of the building', () => {
    const results = measure(scenario('n=3.0'), pair, quick);
    expect(results[before.name].outsideFloorPct).toBeGreaterThan(10);
    expect(results[live.name].outsideFloorPct).toBe(0);
    expect(results[live.name].p95).toBeLessThan(4);
  });
});
