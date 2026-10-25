import { Type } from 'class-transformer';
import { Matches, Max, Min } from 'class-validator';
import { MQTT_URL_PATTERN, validateEnvironment } from './index';

class Example {
  @Matches(MQTT_URL_PATTERN)
  MQTT_URL!: string;

  @Matches(/\S/)
  SECRET!: string;

  @Type(() => Number)
  @Min(0)
  @Max(10)
  SPEED = 1.4;
}

const valid = { MQTT_URL: 'mqtt://localhost:1883', SECRET: 'hunter2' };

describe('validateEnvironment', () => {
  it('fills in defaults and reads numbers from their string form', () => {
    expect(validateEnvironment(Example, valid)).toMatchObject({ ...valid, SPEED: 1.4 });
    expect(validateEnvironment(Example, { ...valid, SPEED: '0' }).SPEED).toBe(0);
  });

  it('treats an empty, blank or undefined value as not set', () => {
    expect(validateEnvironment(Example, { ...valid, SPEED: ' ' }).SPEED).toBe(1.4);
    expect(validateEnvironment(Example, { ...valid, SPEED: undefined }).SPEED).toBe(1.4);
    expect(() => validateEnvironment(Example, { ...valid, SECRET: '' })).toThrow(
      'invalid environment: SECRET missing or invalid',
    );
  });

  it('names every bad key and never a value', () => {
    expect(() => validateEnvironment(Example, { MQTT_URL: 'http://user:hunter2@broker', SPEED: '11' })).toThrow(
      /^invalid environment: MQTT_URL, SECRET, SPEED missing or invalid$/,
    );
  });

  it('accepts the broker schemes mqtt.js connects with in Node and nothing else', () => {
    for (const url of ['mqtt://a:1883', 'mqtts://a', 'tcp://a', 'tls://a', 'ssl://a', 'ws://a', 'wss://a']) {
      expect(MQTT_URL_PATTERN.test(url)).toBe(true);
    }
    for (const url of ['wxs://a', 'http://a', 'a:1883', 'mqtt://']) {
      expect(MQTT_URL_PATTERN.test(url)).toBe(false);
    }
  });
});
