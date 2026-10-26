import { Entity } from '@marauder/shared';

export interface Snapshot {
  entities: readonly Entity[];
  heardDuring: ReadonlySet<string>;
}

export function mergeSnapshot(known: Readonly<Record<string, Entity>>, snapshot: Snapshot): Record<string, Entity> {
  const merged = Object.fromEntries(snapshot.entities.map((entity) => [entity.id, entity]));
  for (const id of snapshot.heardDuring) {
    const newer = known[id];
    if (newer) {
      merged[id] = newer;
    }
  }
  return merged;
}
