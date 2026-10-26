import { DEFAULT_RECEIVERS, DEFAULT_SCENE } from './scene';
import { DEFAULT_TRAFFIC, createDefaultWorld, seededRandom } from './sim';

function world(dropProb: number, seed: number) {
  return createDefaultWorld({ dropProb, random: seededRandom(seed) });
}

describe('simulated world', () => {
  it('replays the same walk for the same seed', () => {
    const a = world(0.08, 11);
    const b = world(0.08, 11);
    for (let t = 0; t < 600; t++) {
      a.advance(0.1, t * 100);
      b.advance(0.1, t * 100);
    }
    expect(a.tags).toEqual(b.tags);
    expect(a.signals(60_000)).toEqual(b.signals(60_000));
  });

  it('keeps every tag on the floor and hears it from every receiver when nothing drops', () => {
    const w = world(0, 5);
    let offFloor = 0;
    for (let t = 0; t < 3000; t++) {
      w.advance(0.1, t * 100);
      for (const tag of w.tags) {
        if (tag.x < 0 || tag.y < 0 || tag.x > DEFAULT_SCENE.width || tag.y > DEFAULT_SCENE.height) {
          offFloor += 1;
        }
      }
    }
    expect(offFloor).toBe(0);
    expect(w.signals(300_000)).toHaveLength(DEFAULT_TRAFFIC.tagCount * DEFAULT_RECEIVERS.length);
  });

  it('refuses a scene without rooms to walk between', () => {
    const nodes = DEFAULT_SCENE.nodes.filter((node) => !node.id.startsWith('room-'));
    expect(() =>
      createDefaultWorld({ scene: { ...DEFAULT_SCENE, nodes, edges: [] }, random: seededRandom(1) }),
    ).toThrow('the scene has no room- nodes for the tags to walk between');
  });

  it('refuses a scene whose paths lead to nodes it does not have', () => {
    const edges: [string, string][] = [...DEFAULT_SCENE.edges, ['room-lab', 'c55']];
    expect(() => createDefaultWorld({ scene: { ...DEFAULT_SCENE, edges }, random: seededRandom(1) })).toThrow(
      'the scene has an edge from room-lab to c55, but not both nodes',
    );
  });
});
