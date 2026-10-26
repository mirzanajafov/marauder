import { MAX_POSITION_FLUSH_MS, PositionUpdate } from '@marauder/shared';
import { QUIET_TRACK_MS, applyPositions, dropQuietTracks } from './tracks';

function position(entityId: string, x: number): PositionUpdate {
  return { entityId, x, y: 0, accuracy: 1, ts: 0, name: null, status: 'unknown', kind: null };
}

describe('live tracks', () => {
  it('moves a tag to each new position and walks its trail along', () => {
    const first = applyPositions({}, [position('a', 0)], 1_000);
    const second = applyPositions(first, [position('a', 2)], 1_150);

    expect(second.a?.position.x).toBe(2);
    expect(second.a?.trail.map((point) => point.x)).toEqual([0, 2]);
    expect(second.a?.heardAt).toBe(1_150);
  });

  it('walks the trail through every position of a tag in one batch', () => {
    const tracks = applyPositions({}, [position('a', 0), position('a', 2)], 0);

    expect(tracks.a?.trail.map((point) => point.x)).toEqual([0, 2]);
  });

  it('drops a tag the server stopped placing and keeps the ones it still places', () => {
    const tracks = applyPositions(applyPositions({}, [position('gone', 0)], 0), [position('here', 0)], QUIET_TRACK_MS);

    expect(Object.keys(dropQuietTracks(tracks, QUIET_TRACK_MS + 1))).toEqual(['here']);
  });

  it('waits for at least two missed batches at the slowest flush the API allows before dropping a tag', () => {
    expect(QUIET_TRACK_MS).toBeGreaterThan(2 * MAX_POSITION_FLUSH_MS);
  });

  it('keeps the same tracks while every tag is still heard', () => {
    const tracks = applyPositions({}, [position('a', 0)], 0);

    expect(dropQuietTracks(tracks, QUIET_TRACK_MS)).toBe(tracks);
  });
});
