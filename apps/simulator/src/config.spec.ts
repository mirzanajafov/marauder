import { DEFAULT_TRAFFIC } from '@marauder/shared';
import { loadConfig } from './config';

const MQTT_URL = 'mqtt://localhost:1883';

describe('loadConfig', () => {
  it('uses the shared traffic defaults for every knob that is not set', () => {
    expect(loadConfig({ MQTT_URL })).toEqual({ mqttUrl: MQTT_URL, hz: 10, traffic: DEFAULT_TRAFFIC });
  });

  it('reads numbers from their string form and keeps an explicit zero', () => {
    expect(loadConfig({ MQTT_URL, SIM_HZ: '20', SIM_NOISE_DB: '0', SIM_SPEED: '0', SIM_DROP_PROB: '0' })).toMatchObject(
      { hz: 20, traffic: { noiseDb: 0, speed: 0, dropProb: 0 } },
    );
  });

  it('refuses to start without a broker URL and never echoes the value', () => {
    expect(() => loadConfig({})).toThrow('invalid environment: MQTT_URL missing or invalid');
    expect(() => loadConfig({ MQTT_URL: 'http://sim:secret@localhost:1883' })).toThrow(
      /^invalid environment: MQTT_URL missing or invalid$/,
    );
  });

  it('uses the default for a knob listed without a value', () => {
    expect(loadConfig({ MQTT_URL, SIM_SPEED: '', SIM_NOISE_DB: ' ' }).traffic).toEqual(DEFAULT_TRAFFIC);
  });

  it('names every bad knob at once, an upside-down dwell range included', () => {
    expect(() =>
      loadConfig({ MQTT_URL, SIM_DROP_PROB: 'often', SIM_HZ: '0', SIM_TAG_COUNT: '2.5', SIM_DWELL_MAX_MS: '1000' }),
    ).toThrow(
      'invalid environment: SIM_HZ, SIM_TAG_COUNT, SIM_DROP_PROB, SIM_DWELL_MIN_MS, SIM_DWELL_MAX_MS missing or invalid',
    );
  });

  it('names both dwell knobs when the range is upside down, whichever one was set', () => {
    expect(() => loadConfig({ MQTT_URL, SIM_DWELL_MAX_MS: '1000' })).toThrow(
      'invalid environment: SIM_DWELL_MIN_MS, SIM_DWELL_MAX_MS missing or invalid',
    );
  });

  it('names only the dwell knob that is not a number', () => {
    expect(() => loadConfig({ MQTT_URL, SIM_DWELL_MIN_MS: 'abc' })).toThrow(
      'invalid environment: SIM_DWELL_MIN_MS missing or invalid',
    );
  });
});
