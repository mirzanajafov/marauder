import { RawSignal, Receiver } from '@marauder/shared';
import { Anchor, Estimate, rssiToDistance } from './position-fit';
import { DROP_TRACK_MS, STALE_READING_MS, TrackedEntity, Tracker } from './tracker';

const EXPONENT = 2.5;
const TX_POWER = -59;
const T0 = 1_000_000;

const ada: TrackedEntity = { id: 'e1', name: null, kind: null, status: 'unknown' };
const layout = new Map<string, Receiver>([
  ['R1', { id: 'R1', name: 'NW', x: 0, y: 0, floor: 0 }],
  ['R2', { id: 'R2', name: 'NE', x: 40, y: 0, floor: 0 }],
]);

function trackerWith(estimates: Estimate[] = []) {
  const solve = jest.fn((anchors: Anchor[]) => estimates.shift() ?? { x: anchors.length, y: 0, accuracy: 1 });
  return { tracker: new Tracker({ pathLossExponent: EXPONENT, alpha: 0.3, rssiAlpha: 0.2, solve }), solve };
}

function signal(receiverId: string, rssi: number, ts: number): RawSignal {
  return { fingerprint: 'tag-01', receiverId, rssi, txPower: TX_POWER, ts };
}

describe('Tracker', () => {
  it('smooths each receiver reading in dB before turning it into a distance', () => {
    const { tracker, solve } = trackerWith();
    tracker.record(ada, signal('R1', -60, T0));
    tracker.record(ada, signal('R1', -70, T0 + 100));

    tracker.advance(T0 + 150, layout);

    expect(solve.mock.lastCall?.[0]).toMatchObject([
      { x: 0, y: 0, distance: rssiToDistance(0.2 * -70 + 0.8 * -60, TX_POWER, EXPONENT) },
    ]);
  });

  it('starts a receiver afresh when its previous reading has gone stale', () => {
    const { tracker, solve } = trackerWith();
    tracker.record(ada, signal('R1', -60, T0));
    tracker.record(ada, signal('R1', -70, T0 + STALE_READING_MS + 1));

    tracker.advance(T0 + STALE_READING_MS + 2, layout);

    expect(solve.mock.lastCall?.[0]).toMatchObject([{ distance: rssiToDistance(-70, TX_POWER, EXPONENT) }]);
  });

  it('moves the reported position only part of the way towards each new estimate', () => {
    const { tracker } = trackerWith([
      { x: 10, y: 0, accuracy: 1 },
      { x: 20, y: 0, accuracy: 1 },
    ]);
    tracker.record(ada, signal('R1', -60, T0));

    expect(tracker.advance(T0 + 150, layout)).toMatchObject([{ x: 10, y: 0 }]);
    const [smoothed] = tracker.advance(T0 + 300, layout);
    expect(smoothed?.x).toBeCloseTo(13, 9);
  });

  it('solves only with receivers that are in the layout', () => {
    const { tracker, solve } = trackerWith();
    tracker.record(ada, signal('R1', -60, T0));
    tracker.record(ada, signal('R9', -60, T0));

    tracker.advance(T0 + 150, layout);

    expect(solve.mock.lastCall?.[0]).toMatchObject([{ x: 0, y: 0 }]);
  });

  it('stops solving on stale readings and forgets a tag that has been quiet for long enough', () => {
    const { tracker, solve } = trackerWith([
      { x: 10, y: 0, accuracy: 1 },
      { x: 30, y: 0, accuracy: 1 },
    ]);
    tracker.record(ada, signal('R1', -60, T0));
    tracker.advance(T0 + 150, layout);

    expect(tracker.advance(T0 + STALE_READING_MS + 151, layout)).toEqual([]);
    expect(tracker.advance(T0 + DROP_TRACK_MS + 1, layout)).toEqual([]);

    tracker.record(ada, signal('R1', -60, T0 + DROP_TRACK_MS + 2));
    expect(tracker.advance(T0 + DROP_TRACK_MS + 3, layout)).toMatchObject([{ x: 30 }]);
    expect(solve).toHaveBeenCalledTimes(2);
  });

  it('reports the latest name and status it has heard for each tag', () => {
    const { tracker } = trackerWith();
    tracker.record(ada, signal('R1', -60, T0));
    tracker.record({ ...ada, name: 'Ada', kind: 'person', status: 'tagged' }, signal('R2', -60, T0 + 10));

    expect(tracker.advance(T0 + 150, layout)).toMatchObject([
      { entityId: 'e1', name: 'Ada', kind: 'person', status: 'tagged', ts: T0 + 150 },
    ]);
  });
});
