import { parseSignal } from './parse-signal';

const NOW = 1_700_000_000_000;
const valid = { fingerprint: 'aa:bb:cc', receiverId: 'R1', rssi: -67, txPower: -59, ts: NOW - 40 };

function payload(value: unknown): Buffer {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
}

describe('parseSignal', () => {
  it('reads a well-formed signal as it was sent', () => {
    expect(parseSignal(payload(valid), NOW)).toEqual(valid);
  });

  it('stamps a signal without its own time with the time it arrived', () => {
    const { fingerprint, receiverId, rssi, txPower } = valid;
    expect(parseSignal(payload({ fingerprint, receiverId, rssi, txPower }), NOW)).toEqual({
      fingerprint,
      receiverId,
      rssi,
      txPower,
      ts: NOW,
    });
  });

  it('keeps only the fields of the contract', () => {
    expect(parseSignal(payload({ ...valid, battery: 12 }), NOW)).toEqual(valid);
  });

  it.each([
    ['text that is not JSON', 'rssi=-67'],
    ['JSON that is not an object', '[1, 2]'],
    ['null', 'null'],
    ['a missing fingerprint', { ...valid, fingerprint: undefined }],
    ['an empty receiver id', { ...valid, receiverId: '' }],
    ['an rssi sent as text', { ...valid, rssi: '-67' }],
    ['a missing tx power', { ...valid, txPower: undefined }],
  ])('drops %s', (_reason, value) => {
    expect(parseSignal(payload(value), NOW)).toBeNull();
  });
});
