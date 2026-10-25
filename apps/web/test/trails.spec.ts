import { TRAIL_LENGTH, extendTrail } from '../src/trails';

describe('extendTrail', () => {
  it('starts a trail with the first position', () => {
    expect(extendTrail([], { x: 3, y: 4 })).toEqual([{ x: 3, y: 4 }]);
  });

  it('adds a footstep only once the tag has moved more than half a metre', () => {
    const trail = [{ x: 0, y: 0 }];
    expect(extendTrail(trail, { x: 0.3, y: 0.3 })).toEqual(trail);
    expect(extendTrail(trail, { x: 0.6, y: 0 })).toEqual([...trail, { x: 0.6, y: 0 }]);
  });

  it('keeps only the most recent footsteps', () => {
    let trail = extendTrail([], { x: 0, y: 0 });
    for (let step = 1; step <= TRAIL_LENGTH + 3; step++) {
      trail = extendTrail(trail, { x: step, y: 0 });
    }
    expect(trail).toHaveLength(TRAIL_LENGTH);
    expect(trail[trail.length - 1]).toEqual({ x: TRAIL_LENGTH + 3, y: 0 });
  });
});
