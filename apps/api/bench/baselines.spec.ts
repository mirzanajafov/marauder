import { DEFAULT_RECEIVERS } from '@marauder/shared';
import { Anchor, weightedCentroid } from '../src/position/position-fit';
import { nearestReceiver, trilaterate } from './baselines';

function distanceTo(px: number, py: number, x: number, y: number): number {
  return Math.max(0.1, Math.hypot(px - x, py - y));
}

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

describe('nearestReceiver', () => {
  it('answers with the position of the receiver that reads the shortest distance', () => {
    const anchors: Anchor[] = [
      { x: 0, y: 0, distance: 9, weight: 1 },
      { x: 10, y: 4, distance: 2, weight: 1 },
      { x: 30, y: 20, distance: 2, weight: 1 },
    ];
    expect(nearestReceiver(anchors)).toEqual({ x: 10, y: 4, accuracy: 2 });
  });
});
