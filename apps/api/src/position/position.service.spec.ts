import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_TX_POWER,
  Entity,
  FloorPlan,
  Receiver,
  WsEvents,
} from '@marauder/shared';
import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DEFAULT_POSITION_FLUSH_MS } from '../config/env.validation';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { FloorPlanService } from '../floorplan/floorplan.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiversService } from '../receivers/receivers.service';
import { LAYOUT_RELOAD_MS, PositionService } from './position.service';

const FLUSH_MS = DEFAULT_POSITION_FLUSH_MS;
const TUNING = { POSITION_FLUSH_MS: FLUSH_MS, PATH_LOSS_EXPONENT: DEFAULT_PATH_LOSS_EXPONENT };

const lin: Entity = {
  id: 'e1',
  fingerprint: 'tag-01',
  name: 'Lin',
  kind: 'person',
  status: 'tagged',
  firstSeen: 0,
  lastSeen: 0,
};

function receiver(id: string, x: number, y: number): Receiver {
  return { id, name: id, x, y, floor: 0 };
}

function cleanRssi(px: number, py: number, receiver: Receiver): number {
  const d = Math.max(0.1, Math.hypot(px - receiver.x, py - receiver.y));
  return DEFAULT_TX_POWER - 10 * DEFAULT_PATH_LOSS_EXPONENT * Math.log10(d);
}

const opened: TestingModule[] = [];

async function positionService({
  receivers = DEFAULT_RECEIVERS,
  createMany = jest.fn().mockResolvedValue({ count: 1 }),
}: { receivers?: Receiver[]; createMany?: jest.Mock } = {}) {
  const emit = jest.fn();
  const layout: { plan: FloorPlan; read: () => Promise<Receiver[]> } = {
    plan: { imageUrl: null, width: 40, height: 25, floor: 0 },
    read: () => Promise.resolve(receivers),
  };
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => TUNING })],
    providers: [
      PositionService,
      { provide: ReceiversService, useValue: { list: () => layout.read() } },
      { provide: FloorPlanService, useValue: { get: () => Promise.resolve(layout.plan) } },
      { provide: PrismaService, useValue: { position: { createMany } } },
      { provide: EventEmitter2, useValue: { emit } },
    ],
  }).compile();
  opened.push(moduleRef);
  const service = moduleRef.get(PositionService);
  await service.onModuleInit();
  return { service, createMany, emit, layout };
}

function hear(service: PositionService, receiver: Receiver, rssi: number, ts = Date.now()): void {
  service.record(lin, { fingerprint: lin.fingerprint, receiverId: receiver.id, rssi, txPower: DEFAULT_TX_POWER, ts });
}

describe('PositionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((moduleRef) => moduleRef.close()));
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('emits one batched position near the true location and writes it to history', async () => {
    const { service, emit, createMany } = await positionService();
    for (const receiver of DEFAULT_RECEIVERS) {
      hear(service, receiver, cleanRssi(15, 9, receiver));
    }

    await jest.advanceTimersByTimeAsync(FLUSH_MS);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(WsEvents.PositionsBatch, {
      positions: [
        expect.objectContaining({
          entityId: 'e1',
          name: 'Lin',
          status: 'tagged',
          x: expect.closeTo(15, 0),
          y: expect.closeTo(9, 0),
        }),
      ],
    });
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('does not place a tag from a reading that is too old', async () => {
    const corner = receiver('R1', 0, 0);
    const { service, emit } = await positionService({ receivers: [corner] });
    hear(service, corner, -70, Date.now() - 60_000);

    await jest.advanceTimersByTimeAsync(FLUSH_MS);

    expect(emit).not.toHaveBeenCalled();
  });

  it('solves against a receiver once the receivers change and stops once it is gone', async () => {
    const { service, emit, layout } = await positionService({ receivers: [] });
    const added = receiver('R9', 10, 5);

    hear(service, added, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(emit).not.toHaveBeenCalled();

    layout.read = () => Promise.resolve([added]);
    await service.reloadLayout();
    hear(service, added, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(emit).toHaveBeenLastCalledWith(WsEvents.PositionsBatch, {
      positions: [expect.objectContaining({ x: expect.closeTo(10, 6), y: expect.closeTo(5, 6) })],
    });

    layout.read = () => Promise.resolve([]);
    await service.reloadLayout();
    emit.mockClear();
    hear(service, added, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(emit).not.toHaveBeenCalled();
  });

  it('clamps to the new floor size once the floor plan changes', async () => {
    const corner = receiver('R9', 40, 25);
    const { service, emit, layout } = await positionService({ receivers: [corner] });

    layout.plan = { imageUrl: null, width: 10, height: 8, floor: 0 };
    await service.reloadLayout();
    hear(service, corner, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);

    expect(emit).toHaveBeenLastCalledWith(WsEvents.PositionsBatch, {
      positions: [expect.objectContaining({ x: 10, y: 8 })],
    });
  });

  it('reloads the layout once a minute through the same one-at-a-time path', async () => {
    const { service } = await positionService();
    const reload = jest.spyOn(service, 'reloadLayout');

    await jest.advanceTimersByTimeAsync(LAYOUT_RELOAD_MS);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('runs one reload at a time, so a slow earlier read cannot overwrite a newer one', async () => {
    const { service, emit, layout } = await positionService({ receivers: [] });
    const added = receiver('R9', 10, 5);
    let releaseStale: (receivers: Receiver[]) => void = () => undefined;
    layout.read = jest
      .fn<Promise<Receiver[]>, []>()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseStale = resolve;
        }),
      )
      .mockResolvedValue([added]);

    const stale = service.reloadLayout();
    const fresh = service.reloadLayout();
    releaseStale([]);
    await Promise.all([stale, fresh]);

    hear(service, added, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('keeps the last layout when a reload fails and picks up the next one on its own', async () => {
    const corner = receiver('R1', 0, 0);
    const added = receiver('R9', 10, 5);
    const { service, emit, layout } = await positionService({ receivers: [corner] });
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    layout.read = () => Promise.reject(new Error('connection refused'));
    await service.reloadLayout();
    expect(error).toHaveBeenCalledWith('could not reload the receivers and floor plan: connection refused');
    hear(service, corner, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(emit).toHaveBeenCalledTimes(1);

    layout.read = () => Promise.resolve([added]);
    await jest.advanceTimersByTimeAsync(LAYOUT_RELOAD_MS);
    emit.mockClear();
    hear(service, added, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('hears about receiver and floor plan saves through the event bus', async () => {
    const rows: Receiver[] = [];
    let stored: FloorPlan | null = null;
    const prisma = {
      receiver: {
        findMany: () => Promise.resolve([...rows]),
        create: ({ data }: { data: Receiver }) => {
          rows.push(data);
          return Promise.resolve(data);
        },
        delete: ({ where }: { where: { id: string } }) => {
          const index = rows.findIndex((receiver) => receiver.id === where.id);
          if (index === -1) {
            return Promise.reject(new Error(`no receiver ${where.id}`));
          }
          rows.splice(index, 1);
          return Promise.resolve();
        },
      },
      floorPlan: {
        findUnique: () => Promise.resolve(stored),
        upsert: ({ update }: { update: FloorPlan }) => {
          stored = update;
          return Promise.resolve(update);
        },
      },
      position: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => TUNING }), EventEmitterModule.forRoot()],
      providers: [PositionService, ReceiversService, FloorPlanService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    opened.push(moduleRef);
    await moduleRef.init();
    const batches = jest.fn();
    moduleRef.get(EventEmitter2).on(WsEvents.PositionsBatch, batches);
    const service = moduleRef.get(PositionService);
    const corner = receiver('R9', 40, 25);

    await moduleRef.get(ReceiversService).create(corner);
    await moduleRef.get(FloorPlanService).update({ width: 10, height: 8 });
    hear(service, corner, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(batches).toHaveBeenLastCalledWith({ positions: [expect.objectContaining({ x: 10, y: 8 })] });

    await moduleRef.get(ReceiversService).remove(corner.id);
    batches.mockClear();
    hear(service, corner, -59);
    await jest.advanceTimersByTimeAsync(FLUSH_MS);
    expect(batches).not.toHaveBeenCalled();
  });

  it('keeps the live map going and logs once when history writes fail', async () => {
    const { service, emit, createMany } = await positionService({
      createMany: jest.fn().mockRejectedValue(new Error('connection refused')),
    });
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    for (let flush = 0; flush < 3; flush++) {
      for (const receiver of DEFAULT_RECEIVERS) {
        hear(service, receiver, cleanRssi(20, 12, receiver));
      }
      await jest.advanceTimersByTimeAsync(FLUSH_MS);
    }

    expect(emit).toHaveBeenCalledTimes(3);
    expect(createMany).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('connection refused'));
  });
});
