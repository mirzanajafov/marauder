import { Errors, Scenario, measure, scenarios, variants } from './accuracy';

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
