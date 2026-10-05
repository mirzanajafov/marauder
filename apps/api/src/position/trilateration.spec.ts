import { DEFAULT_PATH_LOSS_EXPONENT, DEFAULT_RECEIVERS, DEFAULT_TX_POWER } from '@marauder/shared';
import { Anchor, fitPosition, rssiToDistance, trilaterate, weightedCentroid } from './trilateration';

function distanceTo(px: number, py: number, x: number, y: number): number {
  return Math.max(0.1, Math.hypot(px - x, py - y));
}

describe('rssiToDistance', () => {
  it('returns about one metre at the reference power', () => {
    expect(rssiToDistance(DEFAULT_TX_POWER, DEFAULT_TX_POWER, DEFAULT_PATH_LOSS_EXPONENT)).toBeCloseTo(1, 5);
  });

  it('grows as the signal weakens', () => {
    const near = rssiToDistance(-70, DEFAULT_TX_POWER, DEFAULT_PATH_LOSS_EXPONENT);
    const far = rssiToDistance(-85, DEFAULT_TX_POWER, DEFAULT_PATH_LOSS_EXPONENT);
    expect(far).toBeGreaterThan(near);
  });
});

describe('trilaterate', () => {
  it('recovers a known point from exact distances', () => {
    const px = 12;
    const py = 8;
    const anchors: Anchor[] = DEFAULT_RECEIVERS.map((r) => ({
      x: r.x,
      y: r.y,
      distance: distanceTo(px, py, r.x, r.y),
      weight: 1,
    }));
    const estimate = trilaterate(anchors);
    expect(estimate.x).toBeCloseTo(px, 1);
    expect(estimate.y).toBeCloseTo(py, 1);
    expect(estimate.accuracy).toBeLessThan(0.5);
  });

  it('falls back to the centroid with fewer than three anchors', () => {
    const anchors: Anchor[] = [
      { x: 0, y: 0, distance: 5, weight: 1 },
      { x: 10, y: 0, distance: 5, weight: 1 },
    ];
    const estimate = trilaterate(anchors);
    const centroid = weightedCentroid(anchors);
    expect(estimate.x).toBeCloseTo(centroid.x, 6);
    expect(estimate.y).toBeCloseTo(centroid.y, 6);
  });
});

describe('fitPosition', () => {
  const floor = { width: 40, height: 25 };
  const anchorsFor = (px: number, py: number, exponent = 1): Anchor[] =>
    DEFAULT_RECEIVERS.map((r) => ({
      x: r.x,
      y: r.y,
      distance: Math.pow(distanceTo(px, py, r.x, r.y), exponent),
      weight: 1,
    }));

  it('recovers a known point from exact distances', () => {
    const estimate = fitPosition(anchorsFor(12, 8), floor);
    expect(estimate.x).toBeCloseTo(12, 2);
    expect(estimate.y).toBeCloseTo(8, 2);
    expect(estimate.accuracy).toBeLessThan(0.05);
  });

  it('still finds the point when every distance was read with the wrong path-loss exponent', () => {
    const misread = anchorsFor(31, 6, 3 / 2.5);
    const fixed = fitPosition(misread, floor, false);
    const scaled = fitPosition(misread, floor);
    expect(Math.hypot(scaled.x - 31, scaled.y - 6)).toBeLessThan(0.1);
    expect(Math.hypot(fixed.x - 31, fixed.y - 6)).toBeGreaterThan(1);
  });

  it('never answers outside the floor', () => {
    const anchors: Anchor[] = [
      { x: 0, y: 0, distance: 60, weight: 1 },
      { x: 40, y: 0, distance: 70, weight: 1 },
      { x: 0, y: 25, distance: 2, weight: 1 },
      { x: 40, y: 25, distance: 80, weight: 1 },
    ];
    const estimate = fitPosition(anchors, floor);
    expect(estimate.x).toBeGreaterThanOrEqual(0);
    expect(estimate.x).toBeLessThanOrEqual(40);
    expect(estimate.y).toBeGreaterThanOrEqual(0);
    expect(estimate.y).toBeLessThanOrEqual(25);
  });

  it('falls back to the clamped centroid with fewer than three anchors', () => {
    const anchors: Anchor[] = [
      { x: 0, y: 0, distance: 5, weight: 1 },
      { x: 10, y: 0, distance: 5, weight: 1 },
    ];
    const estimate = fitPosition(anchors, floor);
    const centroid = weightedCentroid(anchors);
    expect(estimate.x).toBeCloseTo(centroid.x, 6);
    expect(estimate.y).toBeCloseTo(centroid.y, 6);
  });
});
