import { DEFAULT_RECEIVERS, DEFAULT_SCENE, DEFAULT_TRAFFIC, createDefaultWorld, seededRandom } from '@marauder/shared';
import { Errors, Scenario, measure, scenarios, variants } from './accuracy';

function world(dropProb: number, seed: number) {
  return createDefaultWorld({ dropProb, random: seededRandom(seed) });
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
    expect(w.signals(300_000)).toHaveLength(DEFAULT_TRAFFIC.tagCount * DEFAULT_RECEIVERS.length);
  });
});

describe('accuracy benchmark', () => {
  const quick = { seed: 3, minutes: 2 };

  function beforeAndLive(scenario: Scenario): { before: Errors; live: Errors } {
    const results = measure(scenario, [variants.before, variants.live], quick);
    const before = results[variants.before.name];
    const live = results[variants.live.name];
    if (!before || !live) {
      throw new Error(`measure left out a variant for ${scenario.name}`);
    }
    return { before, live };
  }

  it('gives the same numbers for the same seed', () => {
    const once = { ...quick, minutes: 1 };
    expect(measure(scenarios.simulatorDefault, [variants.live], once)).toEqual(
      measure(scenarios.simulatorDefault, [variants.live], once),
    );
  });

  it('stays about a metre off at the simulator default noise', () => {
    const { before, live } = beforeAndLive(scenarios.simulatorDefault);
    expect(live.samples).toBeGreaterThan(4000);
    expect(live.median).toBeLessThan(1.3);
    expect(live.p95).toBeLessThan(before.p95);
  });

  it('cuts the error under heavy noise', () => {
    const { before, live } = beforeAndLive(scenarios.noise6);
    expect(live.median).toBeLessThan(0.75 * before.median);
  });

  it('keeps a wrong path-loss exponent from throwing dots out of the building', () => {
    const { before, live } = beforeAndLive(scenarios.wrongExponent);
    expect(before.outsideFloorPct).toBeGreaterThan(10);
    expect(live.outsideFloorPct).toBe(0);
    expect(live.p95).toBeLessThan(4);
  });
});
