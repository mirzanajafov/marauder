import { parseSignal } from './parse-signal';

const sent = { fingerprint: 'aa:bb:cc', receiverId: 'R1', rssi: -67, txPower: -59 };

function payload(value: unknown): Buffer {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
}

function withNumber(field: 'rssi' | 'txPower', literal: string): string {
  return JSON.stringify({ ...sent, [field]: 0 }).replace(`"${field}":0`, `"${field}":${literal}`);
}

describe('parseSignal', () => {
  it('reads a well-formed signal', () => {
    expect(parseSignal(payload(sent))).toEqual(sent);
  });

  it.each([
    ['a field outside the contract', { battery: 12 }],
    ['a time from the device', { ts: 1_700_000_000_000 }],
    ['a time that is not a number', { ts: 'yesterday' }],
  ])('leaves out %s', (_extra, extra) => {
    expect(parseSignal(payload({ ...sent, ...extra }))).toEqual(sent);
  });

  it.each([
    ['a fingerprint of 64 characters', { fingerprint: 'f'.repeat(64) }],
    ['a receiver id of 40 characters', { receiverId: 'R'.repeat(40) }],
    ['an rssi of -127 dBm', { rssi: -127 }],
    ['a tx power of 20 dBm', { txPower: 20 }],
  ])('takes %s', (_edge, edge) => {
    expect(parseSignal(payload({ ...sent, ...edge }))).toEqual({ ...sent, ...edge });
  });

  it.each([
    ['text that is not JSON', 'rssi=-67'],
    ['JSON that is not an object', '[1, 2]'],
    ['null', 'null'],
    ['a missing fingerprint', { ...sent, fingerprint: undefined }],
    ['an empty receiver id', { ...sent, receiverId: '' }],
    ['an rssi sent as text', { ...sent, rssi: '-67' }],
    ['a missing tx power', { ...sent, txPower: undefined }],
    ['a blank fingerprint', { ...sent, fingerprint: '   ' }],
    ['a fingerprint longer than 64 characters', { ...sent, fingerprint: 'f'.repeat(65) }],
    ['a fingerprint with a control character', { ...sent, fingerprint: 'aa\u0000bb' }],
    ['a receiver id with a space', { ...sent, receiverId: 'Hall A' }],
    ['a receiver id that is only dots', { ...sent, receiverId: '..' }],
    ['a receiver id that starts with an underscore', { ...sent, receiverId: '_R1' }],
    ['a receiver id longer than 40 characters', { ...sent, receiverId: 'R'.repeat(41) }],
    ['an rssi below what a radio reports', { ...sent, rssi: -128 }],
    ['an rssi above what a radio reports', { ...sent, rssi: 21 }],
    ['an rssi that overflows to infinity', withNumber('rssi', '-1e999')],
    ['a tx power that overflows to infinity', withNumber('txPower', '1e999')],
  ])('drops %s', (_reason, value) => {
    expect(parseSignal(payload(value))).toBeNull();
  });
});
