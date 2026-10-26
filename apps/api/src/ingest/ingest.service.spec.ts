import { EventEmitter } from 'node:events';
import { Entity, ReceivedSignal } from '@marauder/shared';
import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ResolutionService } from '../entities/resolution.service';
import { PositionService } from '../position/position.service';
import { IngestService } from './ingest.service';

const mockBroker = Object.assign(new EventEmitter(), { subscribe: jest.fn(), end: jest.fn(), connected: true });

jest.mock('mqtt', () => ({ __esModule: true, default: { connect: () => mockBroker } }));

const TOPIC = 'sensors/R1/signals';
const entity: Entity = {
  id: 'e1',
  fingerprint: 'aa:bb:cc',
  name: null,
  kind: null,
  status: 'unknown',
  firstSeen: 0,
  lastSeen: 0,
};

const opened: TestingModule[] = [];

async function ingest() {
  const resolve = jest.fn<Promise<Entity>, [string]>().mockResolvedValue(entity);
  const record = jest.fn<undefined, [string, ReceivedSignal]>();
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, validate: () => ({ MQTT_URL: 'mqtt://localhost:1883' }) })],
    providers: [
      IngestService,
      { provide: ResolutionService, useValue: { resolve } },
      { provide: PositionService, useValue: { record } },
    ],
  }).compile();
  opened.push(moduleRef);
  await moduleRef.init();
  return { resolve, record };
}

const signal = { fingerprint: 'aa:bb:cc', receiverId: 'R1', rssi: -67, txPower: -59 };

function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function deliver(message: string, retain = false): Promise<void> {
  mockBroker.emit('message', TOPIC, Buffer.from(message), { retain });
  await settle();
}

describe('IngestService', () => {
  afterEach(async () => {
    await Promise.all(opened.splice(0).map((moduleRef) => moduleRef.close()));
    mockBroker.removeAllListeners();
    jest.restoreAllMocks();
  });

  it('resolves a well-formed signal from the broker and hands it to the position service', async () => {
    const { resolve, record } = await ingest();
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await deliver(JSON.stringify(signal));

    expect(resolve).toHaveBeenCalledWith('aa:bb:cc');
    expect(record.mock.lastCall).toEqual([entity.id, { ...signal, ts: 1_000 }]);
  });

  it('stamps a signal with the time it arrived, however long its entity takes to resolve', async () => {
    const { resolve, record } = await ingest();
    let finishLookup: (found: Entity) => void = () => undefined;
    resolve.mockReturnValueOnce(
      new Promise((done) => {
        finishLookup = done;
      }),
    );
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await deliver(JSON.stringify(signal));
    clock.mockReturnValue(6_000);
    finishLookup(entity);
    await settle();

    expect(record.mock.lastCall).toEqual([entity.id, { ...signal, ts: 1_000 }]);
  });

  it('ignores a retained signal, which the broker replays on every subscribe however old it is, and says so', async () => {
    const { resolve, record } = await ingest();
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await deliver(JSON.stringify(signal), true);

    expect(resolve).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('retained signals ignored so far: 1, the latest on "sensors/R1/signals"');
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('counts a rejected payload in its own log line, naming the latest topic, and resolves nothing', async () => {
    const { resolve } = await ingest();
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await deliver('rssi=-67');

    expect(resolve).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('signals rejected so far: 1, the latest on "sensors/R1/signals"');
  });
});
