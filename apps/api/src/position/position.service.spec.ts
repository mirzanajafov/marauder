import { DEFAULT_PATH_LOSS_EXPONENT, DEFAULT_RECEIVERS, DEFAULT_TX_POWER, Entity, RawSignal } from '@marauder/shared';
import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DEFAULT_POSITION_FLUSH_MS } from '../config/env.validation';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { FloorPlanService } from '../floorplan/floorplan.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiversService } from '../receivers/receivers.service';
import { LAYOUT_REFRESH_MS, PositionService } from './position.service';

function cleanRssi(px: number, py: number, x: number, y: number): number {
  const d = Math.max(0.1, Math.hypot(px - x, py - y));
  return DEFAULT_TX_POWER - 10 * DEFAULT_PATH_LOSS_EXPONENT * Math.log10(d);
}

const TUNING = { POSITION_FLUSH_MS: DEFAULT_POSITION_FLUSH_MS, PATH_LOSS_EXPONENT: DEFAULT_PATH_LOSS_EXPONENT };

async function positionService({
  list = jest.fn().mockResolvedValue(DEFAULT_RECEIVERS),
  createMany = jest.fn().mockResolvedValue({ count: 1 }),
}: { list?: jest.Mock; createMany?: jest.Mock } = {}) {
  const emit = jest.fn();
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => TUNING })],
    providers: [
      PositionService,
      { provide: ReceiversService, useValue: { list } },
      {
        provide: FloorPlanService,
        useValue: { get: jest.fn().mockResolvedValue({ imageUrl: null, width: 40, height: 25, floor: 0 }) },
      },
      { provide: PrismaService, useValue: { position: { createMany } } },
      { provide: EventEmitter2, useValue: { emit } },
    ],
  }).compile();
  return { service: moduleRef.get(PositionService), list, createMany, emit };
}

describe('PositionService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the last layout when a refresh fails and applies the next one that succeeds', async () => {
    jest.useFakeTimers();
    const { service, list, emit } = await positionService({
      list: jest
        .fn()
        .mockResolvedValueOnce(DEFAULT_RECEIVERS)
        .mockRejectedValueOnce(new Error('connection refused'))
        .mockResolvedValue([]),
    });
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const entity: Entity = {
      id: 'e4',
      fingerprint: 'tag-04',
      name: 'Lin',
      kind: 'person',
      status: 'tagged',
      firstSeen: 0,
      lastSeen: 0,
    };
    const hearFromEveryReceiver = (): void => {
      for (const r of DEFAULT_RECEIVERS) {
        service.record(entity, {
          fingerprint: 'tag-04',
          receiverId: r.id,
          rssi: cleanRssi(10, 5, r.x, r.y),
          txPower: DEFAULT_TX_POWER,
          ts: Date.now(),
        });
      }
    };
    await service.onModuleInit();

    await jest.advanceTimersByTimeAsync(LAYOUT_REFRESH_MS);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('connection refused');

    hearFromEveryReceiver();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(emit).toHaveBeenCalledWith('positions.batch', {
      positions: [expect.objectContaining({ entityId: 'e4', x: expect.closeTo(10, 0), y: expect.closeTo(5, 0) })],
    });

    await jest.advanceTimersByTimeAsync(LAYOUT_REFRESH_MS);
    emit.mockClear();
    hearFromEveryReceiver();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(list).toHaveBeenCalledTimes(3);
    expect(emit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });

  it('emits a batched position near the true location', async () => {
    const { service, emit, createMany } = await positionService();
    await (service as any).refreshLayout();

    const entity: Entity = {
      id: 'e1',
      fingerprint: 'tag-01',
      name: 'Neo',
      kind: 'person',
      status: 'tagged',
      firstSeen: 0,
      lastSeen: 0,
    };
    const px = 15;
    const py = 9;
    const now = Date.now();
    for (const r of DEFAULT_RECEIVERS) {
      const signal: RawSignal = {
        fingerprint: 'tag-01',
        receiverId: r.id,
        rssi: cleanRssi(px, py, r.x, r.y),
        txPower: DEFAULT_TX_POWER,
        ts: now,
      };
      service.record(entity, signal);
    }

    await (service as any).flush();

    expect(emit).toHaveBeenCalledTimes(1);
    const [event, payload] = emit.mock.calls[0];
    expect(event).toBe('positions.batch');
    expect(payload.positions).toHaveLength(1);
    const pos = payload.positions[0];
    expect(pos.entityId).toBe('e1');
    expect(pos.name).toBe('Neo');
    expect(pos.status).toBe('tagged');
    expect(pos.x).toBeCloseTo(px, 0);
    expect(pos.y).toBeCloseTo(py, 0);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('drops a track after it goes quiet', async () => {
    const { service, emit } = await positionService();
    await (service as any).refreshLayout();

    const entity: Entity = {
      id: 'e2',
      fingerprint: 'tag-02',
      name: null,
      kind: null,
      status: 'unknown',
      firstSeen: 0,
      lastSeen: 0,
    };
    service.record(entity, {
      fingerprint: 'tag-02',
      receiverId: DEFAULT_RECEIVERS[0].id,
      rssi: -70,
      txPower: DEFAULT_TX_POWER,
      ts: Date.now() - 60_000,
    });

    await (service as any).flush();

    expect(emit).not.toHaveBeenCalled();
    expect((service as any).tracker.size).toBe(0);
  });

  it('keeps the live map going and logs once when history writes fail', async () => {
    const { service, emit, createMany } = await positionService({
      createMany: jest.fn().mockRejectedValue(new Error('connection refused')),
    });
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await (service as any).refreshLayout();

    const entity: Entity = {
      id: 'e3',
      fingerprint: 'tag-03',
      name: 'Ada',
      kind: 'person',
      status: 'tagged',
      firstSeen: 0,
      lastSeen: 0,
    };
    for (let flush = 0; flush < 3; flush++) {
      for (const r of DEFAULT_RECEIVERS) {
        service.record(entity, {
          fingerprint: 'tag-03',
          receiverId: r.id,
          rssi: cleanRssi(20, 12, r.x, r.y),
          txPower: DEFAULT_TX_POWER,
          ts: Date.now(),
        });
      }
      await expect((service as any).flush()).resolves.toBeUndefined();
    }

    expect(emit).toHaveBeenCalledTimes(3);
    expect(createMany).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('connection refused');
  });
});
