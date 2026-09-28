import { Entity as EntityRow } from '@prisma/client';
import { Entity, EntityStatus } from '@marauder/shared';

export function toEntityDto(row: EntityRow): Entity {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    name: row.name,
    kind: row.kind,
    status: row.status as EntityStatus,
    firstSeen: row.firstSeen.getTime(),
    lastSeen: row.lastSeen.getTime(),
  };
}
