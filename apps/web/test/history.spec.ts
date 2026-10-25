import { HistoryPoint, MAX_HISTORY_BUCKETS } from '@marauder/shared';
import { WINDOWS, bucketFor, buildFrames, trailsAt } from '../src/history';

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

    expect(trailsAt(frames, 1)).toEqual({
      a: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
  });

  it('draws a tag that stood still as one footprint, the way the live view does', () => {
    const frames = buildFrames([point('a', 1000, 1), point('a', 2000, 1), point('a', 3000, 1.2)]);

    expect(trailsAt(frames, 2)).toEqual({ a: [{ x: 1, y: 0 }] });
  });

  it('asks for no more buckets than the API allows in any window it offers', () => {
    for (const { ms } of WINDOWS) {
      expect(ms / bucketFor(ms)).toBeLessThanOrEqual(MAX_HISTORY_BUCKETS);
    }
  });
});
