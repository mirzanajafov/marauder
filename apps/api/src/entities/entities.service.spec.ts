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

  it('keeps resolving a fingerprint to the same entity after it is renamed', async () => {
    const { entities, resolution } = await entitiesTestingModule();
    const id = await resolution.resolve('tag-01');
    await resolution.resolve('tag-01');

    await entities.tag(id, { name: 'Ada' });

    await expect(resolution.resolve('tag-01')).resolves.toBe(id);
    await expect(entities.get(id)).resolves.toMatchObject({ name: 'Ada', status: 'tagged' });
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
