import { receiverIdFromTopic, signalTopic, SIGNAL_TOPIC_WILDCARD } from '@marauder/shared';

describe('signal topics', () => {
  it('builds a per-receiver topic', () => {
    expect(signalTopic('R1')).toBe('sensors/R1/signals');
  });

  it('parses the receiver id back out', () => {
    expect(receiverIdFromTopic('sensors/R1/signals')).toBe('R1');
  });

  it('rejects a topic that does not match the shape', () => {
    expect(receiverIdFromTopic('sensors/R1')).toBeNull();
    expect(receiverIdFromTopic('nonsense')).toBeNull();
  });

  it('exposes the wildcard the ingest subscribes to', () => {
    expect(SIGNAL_TOPIC_WILDCARD).toBe('sensors/+/signals');
  });
});
