import { RECEIVER_ID_PATTERN, SignalPayload, isReportableDbm } from '@marauder/shared';
import { isRecord } from '../common/is-record';

const FINGERPRINT_PATTERN = /^[\w.:-]{1,64}$/;

function readJson(payload: Buffer): unknown {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
}

function matches(pattern: RegExp, value: unknown): value is string {
  return typeof value === 'string' && pattern.test(value);
}

export function parseSignal(payload: Buffer): SignalPayload | null {
  const raw = readJson(payload);
  if (!isRecord(raw)) {
    return null;
  }
  const { fingerprint, receiverId, rssi, txPower } = raw;
  if (
    !matches(FINGERPRINT_PATTERN, fingerprint) ||
    !matches(RECEIVER_ID_PATTERN, receiverId) ||
    !isReportableDbm(rssi) ||
    !isReportableDbm(txPower)
  ) {
    return null;
  }
  return { fingerprint, receiverId, rssi, txPower };
}
