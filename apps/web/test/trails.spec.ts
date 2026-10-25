import { TRAIL_LENGTH, extendTrail, footsteps } from '../src/trails';

describe('extendTrail', () => {
  it('starts a trail with the first position', () => {
    expect(extendTrail([], { x: 3, y: 4 })).toEqual([{ x: 3, y: 4 }]);
  });

  it('adds a footstep only once the tag has moved more than half a metre', () => {
    const trail = [{ x: 0, y: 0 }];
    expect(extendTrail(trail, { x: 0.3, y: 0.3 })).toBe(trail);
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

describe('footsteps', () => {
  it('points every footstep, the oldest one too, the way the tag walked', () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(footsteps(trail).map((step) => step.heading)).toEqual([0, 0, Math.PI / 2]);
  });

  it('points a lone footstep along the x axis', () => {
    expect(footsteps([{ x: 2, y: 3 }])).toEqual([{ x: 2, y: 3, heading: 0 }]);
  });
});
