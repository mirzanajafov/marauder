import { Entity } from '@marauder/shared';

export function mergeSnapshot(
  snapshot: readonly Entity[],
  known: Readonly<Record<string, Entity>>,
  heardSince: ReadonlySet<string>,
): Record<string, Entity> {
  const merged = Object.fromEntries(snapshot.map((entity) => [entity.id, entity]));
  for (const id of heardSince) {
    const newer = known[id];
    if (newer) {
      merged[id] = newer;
    }
  }
  return merged;
}
