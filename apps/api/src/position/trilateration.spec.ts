import { DEFAULT_PATH_LOSS_EXPONENT, DEFAULT_RECEIVERS, DEFAULT_TX_POWER } from '@marauder/shared';
import { Anchor, rssiToDistance, trilaterate, weightedCentroid } from './trilateration';

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
