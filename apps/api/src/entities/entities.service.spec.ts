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

  it('answers 404 for an id it does not know', async () => {
    const { entities } = await entitiesTestingModule();
    await expect(entities.get('missing')).rejects.toThrow(NotFoundException);
  });
});
