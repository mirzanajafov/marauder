import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_TX_POWER,
  Entity,
  RawSignal,
} from '@marauder/shared';
import { PositionService } from './position.service';

function cleanRssi(px: number, py: number, x: number, y: number): number {
  const d = Math.max(0.1, Math.hypot(px - x, py - y));
  return DEFAULT_TX_POWER - 10 * DEFAULT_PATH_LOSS_EXPONENT * Math.log10(d);
}

describe('PositionService', () => {
  it('emits a batched position near the true location', async () => {
    const receiversService = { list: jest.fn().mockResolvedValue(DEFAULT_RECEIVERS) };
    const prisma = { position: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const events = { emit: jest.fn() };
    const service = new PositionService(receiversService as any, prisma as any, events as any);
    await (service as any).refreshReceivers();

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

    expect(events.emit).toHaveBeenCalledTimes(1);
    const [event, payload] = events.emit.mock.calls[0];
    expect(event).toBe('positions.batch');
    expect(payload.positions).toHaveLength(1);
    const pos = payload.positions[0];
    expect(pos.entityId).toBe('e1');
    expect(pos.name).toBe('Neo');
    expect(pos.status).toBe('tagged');
    expect(pos.x).toBeCloseTo(px, 0);
    expect(pos.y).toBeCloseTo(py, 0);
    expect(prisma.position.createMany).toHaveBeenCalledTimes(1);
  });

  it('drops a track after it goes quiet', async () => {
    const receiversService = { list: jest.fn().mockResolvedValue(DEFAULT_RECEIVERS) };
    const prisma = { position: { createMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const events = { emit: jest.fn() };
    const service = new PositionService(receiversService as any, prisma as any, events as any);
    await (service as any).refreshReceivers();

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

    expect(events.emit).not.toHaveBeenCalled();
    expect((service as any).tracker.size).toBe(0);
  });
});
