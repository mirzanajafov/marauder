import { RawSignal } from '@marauder/shared';
import { isRecord } from '../common/is-record';

function readJson(payload: Buffer): unknown {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
}

export function parseSignal(payload: Buffer, receivedAt: number): RawSignal | null {
  const raw = readJson(payload);
  if (!isRecord(raw)) {
    return null;
  }
  const { fingerprint, receiverId, rssi, txPower, ts } = raw;
  if (
    typeof fingerprint !== 'string' ||
    fingerprint === '' ||
    typeof receiverId !== 'string' ||
    receiverId === '' ||
    typeof rssi !== 'number' ||
    typeof txPower !== 'number'
  ) {
    return null;
  }
  return { fingerprint, receiverId, rssi, txPower, ts: typeof ts === 'number' ? ts : receivedAt };
}
