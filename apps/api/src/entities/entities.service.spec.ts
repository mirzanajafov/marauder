import { NotFoundException } from '@nestjs/common';
import { WsEvents } from '@marauder/shared';
import { entitiesTestingModule } from '../../test/entities.fakes';

describe('EntitiesService', () => {
  it('tags an entity, replaces the copy that signals resolve to and announces the change', async () => {
    const { entities, resolution, emit } = await entitiesTestingModule();
    const unknown = await resolution.resolve('tag-01');
    await resolution.resolve('tag-01');

    const tagged = await entities.tag(unknown.id, { name: 'Ada', kind: 'person' });

    expect(tagged).toMatchObject({ id: unknown.id, name: 'Ada', kind: 'person', status: 'tagged' });
    expect(emit).toHaveBeenLastCalledWith(WsEvents.EntityUpdated, { entity: tagged });
    await expect(resolution.resolve('tag-01')).resolves.toMatchObject({ name: 'Ada', status: 'tagged' });
  });

  it('keeps the new name when a lookup that read the row before the rename finishes after it', async () => {
    const { entities, resolution, table } = await entitiesTestingModule();
    const unknown = await resolution.resolve('tag-01');
    const before = { ...(await table.findUniqueOrThrow({ where: { id: unknown.id } })) };
    let finishRead: () => void = () => undefined;
    table.findUnique.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = () => resolve(before);
        }),
    );

    const lookup = resolution.resolve('tag-01');
    await entities.tag(unknown.id, { name: 'Ada' });
    finishRead();
    await lookup;

    await expect(resolution.resolve('tag-01')).resolves.toMatchObject({ name: 'Ada', status: 'tagged' });
  });

  it('keeps the kind when a rename leaves it out', async () => {
    const { entities, resolution } = await entitiesTestingModule();
    const { id } = await resolution.resolve('tag-01');
    await entities.tag(id, { name: 'Ada', kind: 'person' });

    await expect(entities.tag(id, { name: 'Ada L.' })).resolves.toMatchObject({ name: 'Ada L.', kind: 'person' });
  });

  it('answers 404 for an id it does not know', async () => {
    const { entities } = await entitiesTestingModule();
    await expect(entities.get('missing')).rejects.toThrow(NotFoundException);
  });
});
