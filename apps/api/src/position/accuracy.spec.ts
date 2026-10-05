import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_SCENE,
  DEFAULT_TX_POWER,
  createWorld,
  seededRandom,
} from '@marauder/shared';
import { measure, scenarios, variants } from './accuracy';

const quick = { seed: 3, minutes: 3, tagCount: 6 };
const live = variants[variants.length - 1];

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
    for (let t = 0; t < 3000; t++) {
      w.advance(0.1, t * 100);
      for (const tag of w.tags) {
        expect(tag.x).toBeGreaterThanOrEqual(0);
        expect(tag.y).toBeGreaterThanOrEqual(0);
        expect(tag.x).toBeLessThanOrEqual(DEFAULT_SCENE.width);
        expect(tag.y).toBeLessThanOrEqual(DEFAULT_SCENE.height);
      }
    }
    expect(w.signals(300_000)).toHaveLength(6 * DEFAULT_RECEIVERS.length);
  });
});

describe('accuracy benchmark', () => {
  it('gives the same numbers for the same seed', () => {
    const scenario = scenarios[0];
    expect(measure(scenario, variants, quick)).toEqual(measure(scenario, variants, quick));
  });

  it('keeps the live estimator about a metre off at the default noise, ahead of every baseline', () => {
    const results = measure(scenarios[0], variants, quick);
    const ours = results[live.name];
    expect(ours.samples).toBeGreaterThan(5000);
    expect(ours.median).toBeLessThan(1.3);
    for (const variant of variants.slice(0, -1)) {
      expect(ours.median).toBeLessThan(results[variant.name].median);
    }
  });
});
