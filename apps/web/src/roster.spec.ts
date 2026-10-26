import { Entity } from '@marauder/shared';
import { mergeSnapshot } from './roster';

function entity(id: string, name: string | null = null): Entity {
  return {
    id,
    fingerprint: `fp-${id}`,
    name,
    kind: null,
    status: name === null ? 'unknown' : 'tagged',
    firstSeen: 0,
    lastSeen: 0,
  };
}

describe('mergeSnapshot', () => {
  it('replaces what the page knew with the snapshot', () => {
    const known = { a: entity('a', 'Old'), gone: entity('gone') };

    expect(mergeSnapshot(known, { entities: [entity('a', 'Ada'), entity('b')], heardDuring: new Set() })).toEqual({
      a: entity('a', 'Ada'),
      b: entity('b'),
    });
  });

  it('keeps a tag announced while the snapshot was on its way over the older copy in it', () => {
    const known = { a: entity('a', 'Ada'), c: entity('c') };

    expect(mergeSnapshot(known, { entities: [entity('a')], heardDuring: new Set(['a', 'c']) })).toEqual({
      a: entity('a', 'Ada'),
      c: entity('c'),
    });
  });
});
