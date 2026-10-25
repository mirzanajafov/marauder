import { EventEmitter } from 'node:events';
import { DEFAULT_RECEIVERS, createDefaultWorld, seededRandom } from '@marauder/shared';
import { startSimulation } from './simulation';

const TAGS = 2;
const PER_TICK = TAGS * DEFAULT_RECEIVERS.length;

class FakeClient extends EventEmitter {
  connected = true;
  readonly publish = jest.fn<undefined, [string, string]>();

  dropAndReconnect(): void {
    this.connected = false;
    jest.advanceTimersByTime(500);
    this.connected = true;
    this.emit('connect');
  }
}

function world() {
  return createDefaultWorld({ tagCount: TAGS, dropProb: 0, random: seededRandom(1) });
}

describe('startSimulation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('publishes every tag to every receiver once per tick on its receiver topic', () => {
    const client = new FakeClient();
    startSimulation(client, world(), 10);
    client.emit('connect');

    jest.advanceTimersByTime(1000);

    expect(client.publish).toHaveBeenCalledTimes(10 * PER_TICK);
    expect(client.publish).toHaveBeenCalledWith('sensors/R1/signals', expect.stringContaining('"receiverId":"R1"'));
  });

  it('keeps one loop at the same rate however often the client reconnects', () => {
    const client = new FakeClient();
    startSimulation(client, world(), 10);
    client.emit('connect');

    for (let outage = 0; outage < 3; outage++) {
      client.dropAndReconnect();
    }
    client.publish.mockClear();
    jest.advanceTimersByTime(1000);

    expect(client.publish).toHaveBeenCalledTimes(10 * PER_TICK);
  });

  it('keeps the tags walking but publishes nothing while disconnected', () => {
    const client = new FakeClient();
    const simulated = world();
    startSimulation(client, simulated, 10);
    const start = simulated.tags.map((tag) => ({ x: tag.x, y: tag.y }));

    client.connected = false;
    jest.advanceTimersByTime(10_000);

    expect(client.publish).not.toHaveBeenCalled();
    expect(simulated.tags.map((tag) => ({ x: tag.x, y: tag.y }))).not.toEqual(start);
  });
});
