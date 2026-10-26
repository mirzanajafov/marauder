import { SIGNAL_TOPIC_WILDCARD, signalTopic } from './topics';

describe('signal topics', () => {
  it('builds the topic of a receiver so that the ingest wildcard covers it', () => {
    const levels = signalTopic('R1').split('/');
    expect(levels).toEqual(['sensors', 'R1', 'signals']);
    expect(SIGNAL_TOPIC_WILDCARD.split('/')).toEqual(levels.map((level, index) => (index === 1 ? '+' : level)));
  });
});
