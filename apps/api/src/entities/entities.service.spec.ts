import { NotFoundException } from '@nestjs/common';
import { WsEvents } from '@marauder/shared';
import { entitiesTestingModule } from '../../test/entities.fakes';

describe('EntitiesService', () => {
  it('tags an entity and announces the change', async () => {
    const { entities, resolution, emit } = await entitiesTestingModule();
    const id = await resolution.resolve('tag-01');

    const tagged = await entities.tag(id, { name: 'Ada', kind: 'person' });

    expect(tagged).toMatchObject({ id, name: 'Ada', kind: 'person', status: 'tagged' });
    expect(emit).toHaveBeenLastCalledWith(WsEvents.EntityUpdated, { entity: tagged });
  });

  it('leaves what a fingerprint resolves to alone on a rename, since the cache only holds the id', async () => {
    const { entities, resolution, table, redis } = await entitiesTestingModule();
    const id = await resolution.resolve('tag-01');
    await resolution.resolve('tag-01');
    const cached = new Map(redis.values);

    await entities.tag(id, { name: 'Ada' });
    table.findUnique.mockClear();

    expect(redis.values).toEqual(cached);
    await expect(resolution.resolve('tag-01')).resolves.toBe(id);
    expect(table.findUnique).not.toHaveBeenCalled();
  });

  it('keeps the kind when a rename leaves it out', async () => {
    const { entities, resolution } = await entitiesTestingModule();
    const id = await resolution.resolve('tag-01');
    await entities.tag(id, { name: 'Ada', kind: 'person' });

    await expect(entities.tag(id, { name: 'Ada L.' })).resolves.toMatchObject({ name: 'Ada L.', kind: 'person' });
  });

  it('answers 404 for an id it does not know', async () => {
    const { entities } = await entitiesTestingModule();
    await expect(entities.get('missing')).rejects.toThrow(NotFoundException);
  });
});
