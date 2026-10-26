import { Logger } from '@nestjs/common';
import { WsEvents } from '@marauder/shared';
import { entitiesTestingModule } from '../../test/entities.fakes';
import { SEEN_INTERVAL_MS } from './resolution.service';

describe('ResolutionService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an unknown entity on the first sighting and announces it once', async () => {
    const { resolution, table, emit } = await entitiesTestingModule();

    const id = await resolution.resolve('tag-01');

    const row = await table.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ fingerprint: 'tag-01', status: 'unknown', name: null, kind: null });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(WsEvents.EntityDiscovered, {
      entity: { ...row, firstSeen: row.firstSeen.getTime(), lastSeen: row.lastSeen.getTime() },
    });
  });

  it('reads the database on the second sighting and the cache from the third on', async () => {
    const { resolution, table, emit } = await entitiesTestingModule();
    const first = await resolution.resolve('tag-01');
    table.findUnique.mockClear();

    await resolution.resolve('tag-01');
    await expect(resolution.resolve('tag-01')).resolves.toBe(first);

    expect(table.findUnique).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('reads the database again when the cache has lost an entity', async () => {
    const { resolution, table, redis } = await entitiesTestingModule();
    const stored = await resolution.resolve('tag-01');
    await resolution.resolve('tag-01');
    redis.values.clear();
    table.findUnique.mockClear();

    await expect(resolution.resolve('tag-01')).resolves.toBe(stored);
    expect(table.findUnique).toHaveBeenCalledTimes(1);
    expect(table.rows).toHaveLength(1);
  });

  it('lets a cached id expire, so a database restored with new ids shows up within a minute', async () => {
    jest.useFakeTimers();
    const { resolution, table } = await entitiesTestingModule();
    const before = await resolution.resolve('tag-01');
    await resolution.resolve('tag-01');
    await table.update({ where: { id: before }, data: { id: 'restored-id' } });

    await expect(resolution.resolve('tag-01')).resolves.toBe(before);
    jest.advanceTimersByTime(60_000);
    await expect(resolution.resolve('tag-01')).resolves.toBe('restored-id');
  });

  it('creates one entity and one announcement when two first sightings race', async () => {
    const { resolution, table, emit } = await entitiesTestingModule();

    const [a, b] = await Promise.all([resolution.resolve('tag-01'), resolution.resolve('tag-01')]);

    expect(a).toBe(b);
    expect(table.createManyAndReturn).toHaveBeenCalledTimes(2);
    expect(table.rows).toHaveLength(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('passes a database failure on', async () => {
    const { resolution, table } = await entitiesTestingModule();
    table.createManyAndReturn.mockRejectedValueOnce(new Error('connection refused'));

    await expect(resolution.resolve('tag-01')).rejects.toThrow('connection refused');
  });

  it('records that an entity was seen at most once per interval, counting its creation', async () => {
    jest.useFakeTimers();
    const { resolution, table } = await entitiesTestingModule();
    await resolution.resolve('tag-01');

    await resolution.resolve('tag-01');
    await resolution.resolve('tag-01');
    expect(table.update).not.toHaveBeenCalled();

    jest.advanceTimersByTime(SEEN_INTERVAL_MS);
    await resolution.resolve('tag-01');
    expect(table.update).toHaveBeenCalledTimes(1);
  });

  it('forgets the entities that went quiet and keeps throttling the ones seen within the interval', async () => {
    jest.useFakeTimers();
    const { resolution, table } = await entitiesTestingModule();
    for (const fingerprint of ['quiet', 'busy', 'recent']) {
      await resolution.resolve(fingerprint);
    }
    jest.advanceTimersByTime(SEEN_INTERVAL_MS);
    await resolution.resolve('busy');
    jest.advanceTimersByTime(SEEN_INTERVAL_MS / 2);
    await resolution.resolve('recent');
    jest.advanceTimersByTime(SEEN_INTERVAL_MS / 2);
    await resolution.resolve('busy');
    expect(resolution.rememberedEntityCount).toBe(2);
    table.update.mockClear();

    jest.advanceTimersByTime(1);
    await resolution.resolve('recent');
    expect(table.update).not.toHaveBeenCalled();
  });

  it('logs when it cannot record that an entity was seen and keeps resolving', async () => {
    const { resolution, table } = await entitiesTestingModule();
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const [stored] = await table.createManyAndReturn({ data: [{ fingerprint: 'tag-01' }], skipDuplicates: true });
    table.update.mockRejectedValueOnce(new Error('connection refused'));

    await expect(resolution.resolve('tag-01')).resolves.toBe(stored?.id);
    await new Promise((resolve) => setImmediate(resolve));

    expect(logError).toHaveBeenCalledWith('could not update lastSeen (1 failed updates so far): connection refused');
  });
});
