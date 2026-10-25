import { validateEnv } from './env.validation';

const required = {
  DATABASE_URL: 'postgresql://marauder:marauder@localhost:5432/marauder',
  REDIS_URL: 'redis://localhost:6379',
  MQTT_URL: 'mqtt://localhost:1883',
  WEB_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'jwt-secret',
  ADMIN_PASSWORD: 'secret',
};

describe('validateEnv', () => {
  it('accepts an environment with every required key and fills in the tuning defaults', () => {
    expect(validateEnv(required)).toMatchObject({
      ...required,
      API_PORT: 3001,
      API_PREFIX: '',
      PATH_LOSS_EXPONENT: 2.5,
      POSITION_FLUSH_MS: 150,
    });
  });

  it('refuses to start without the required keys and names every missing one', () => {
    expect(() => validateEnv({})).toThrow(
      'invalid environment: DATABASE_URL, REDIS_URL, MQTT_URL, WEB_ORIGIN, JWT_SECRET, ADMIN_PASSWORD missing or invalid',
    );
  });

  it('treats an empty or blank secret as missing', () => {
    expect(() => validateEnv({ ...required, JWT_SECRET: '' })).toThrow('invalid environment: JWT_SECRET missing');
    expect(() => validateEnv({ ...required, ADMIN_PASSWORD: '   ' })).toThrow(
      'invalid environment: ADMIN_PASSWORD missing',
    );
  });

  it('reads numbers from their string form', () => {
    expect(
      validateEnv({ ...required, API_PORT: '8080', PATH_LOSS_EXPONENT: '3.1', POSITION_FLUSH_MS: '200' }),
    ).toMatchObject({ API_PORT: 8080, PATH_LOSS_EXPONENT: 3.1, POSITION_FLUSH_MS: 200 });
  });

  it('rejects a tuning value that is not a usable number instead of falling back', () => {
    expect(() => validateEnv({ ...required, API_PORT: 'http' })).toThrow('API_PORT');
    expect(() => validateEnv({ ...required, PATH_LOSS_EXPONENT: '0' })).toThrow('PATH_LOSS_EXPONENT');
    expect(() => validateEnv({ ...required, PATH_LOSS_EXPONENT: 'Infinity' })).toThrow('PATH_LOSS_EXPONENT');
    expect(() => validateEnv({ ...required, POSITION_FLUSH_MS: '3000000000' })).toThrow('POSITION_FLUSH_MS');
  });

  it('rejects a connection URL with the wrong scheme and an origin with a path', () => {
    expect(() => validateEnv({ ...required, REDIS_URL: 'localhost:6379' })).toThrow('REDIS_URL');
    expect(() => validateEnv({ ...required, MQTT_URL: 'http://localhost:1883' })).toThrow('MQTT_URL');
    expect(validateEnv({ ...required, MQTT_URL: 'tls://broker:8883' }).MQTT_URL).toBe('tls://broker:8883');
    expect(() => validateEnv({ ...required, DATABASE_URL: 'mysql://localhost/marauder' })).toThrow('DATABASE_URL');
    for (const origin of [
      'http://localhost:5173/',
      'http://localhost:5173?',
      'https://Marauder.dev',
      'http://u@host',
      'https://marauder.najafov.dev:443',
      'http://localhost:05173',
      'ftp://localhost',
    ]) {
      expect(() => validateEnv({ ...required, WEB_ORIGIN: origin })).toThrow('WEB_ORIGIN');
    }
    expect(validateEnv({ ...required, WEB_ORIGIN: 'http://[::1]:5173' }).WEB_ORIGIN).toBe('http://[::1]:5173');
  });

  it('treats a blank tuning value as not set, so the example env can list keys without values', () => {
    expect(validateEnv({ ...required, POSITION_FLUSH_MS: '', API_PREFIX: '' })).toMatchObject({
      POSITION_FLUSH_MS: 150,
      API_PREFIX: '',
    });
  });

  it('takes a path prefix but not one with spaces', () => {
    expect(validateEnv({ ...required, API_PREFIX: 'api' }).API_PREFIX).toBe('api');
    expect(() => validateEnv({ ...required, API_PREFIX: 'api v1' })).toThrow('API_PREFIX');
  });
});
