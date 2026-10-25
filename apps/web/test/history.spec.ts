import { HistoryPoint, MAX_HISTORY_BUCKETS, MAX_HISTORY_BUCKET_MS, MIN_HISTORY_BUCKET_MS } from '@marauder/shared';
import { WINDOWS, bucketFor, buildFrames } from '../src/history';
import { TrailPoint, extendTrail } from '../src/trails';

function point(entityId: string, time: number, x: number): HistoryPoint {
  return { entityId, time, x, y: 0, accuracy: 1, name: entityId, status: 'tagged' };
}

describe('history frames', () => {
  it('orders frames by time and carries each tag forward until it is heard again', () => {
    const frames = buildFrames([point('b', 2000, 5), point('a', 1000, 1), point('a', 3000, 2)]);

    expect(frames.map((frame) => frame.time)).toEqual([1000, 2000, 3000]);
    expect(frames.map((frame) => Object.keys(frame.points).sort())).toEqual([['a'], ['a', 'b'], ['a', 'b']]);
    expect(frames.map((frame) => frame.points.a?.x)).toEqual([1, 1, 2]);
  });

  it('draws trails from the frames up to the one on screen', () => {
    const frames = buildFrames([point('a', 1000, 1), point('a', 2000, 2), point('a', 3000, 3)]);

    expect(frames[1]?.trails).toEqual({
      a: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
  });

  it('draws the trail the live view would have drawn by that frame, however long the walk', () => {
    const walk = Array.from({ length: 30 }, (_, step) => step * 0.4);
    const frames = buildFrames(walk.map((x, step) => point('a', 1000 * (step + 1), x)));
    const live = walk.reduce<readonly TrailPoint[]>((trail, x) => extendTrail(trail, { x, y: 0 }), []);

    expect(frames[frames.length - 1]?.trails.a).toEqual(live);
  });

  it('draws a tag that stood still as one footprint, the way the live view does', () => {
    const frames = buildFrames([point('a', 1000, 1), point('a', 2000, 1), point('a', 3000, 1.2)]);

    expect(frames[2]?.trails).toEqual({ a: [{ x: 1, y: 0 }] });
  });

  it('asks for buckets the API accepts in every window it offers', () => {
    for (const { ms } of WINDOWS) {
      const bucketMs = bucketFor(ms);
      expect(Number.isInteger(bucketMs)).toBe(true);
      expect(bucketMs).toBeGreaterThanOrEqual(MIN_HISTORY_BUCKET_MS);
      expect(bucketMs).toBeLessThanOrEqual(MAX_HISTORY_BUCKET_MS);
      expect(ms / bucketMs).toBeLessThanOrEqual(MAX_HISTORY_BUCKETS);
    }
  });
});
