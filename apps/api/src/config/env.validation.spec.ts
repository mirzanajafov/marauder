import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts an environment with both secrets', () => {
    expect(validateEnv({ JWT_SECRET: 'jwt-secret', ADMIN_PASSWORD: 'secret' })).toMatchObject({
      JWT_SECRET: 'jwt-secret',
      ADMIN_PASSWORD: 'secret',
    });
  });

  it('refuses to start without the secrets and names every missing one', () => {
    expect(() => validateEnv({})).toThrow('JWT_SECRET, ADMIN_PASSWORD must be set');
  });

  it('treats an empty or blank secret as missing', () => {
    expect(() => validateEnv({ JWT_SECRET: '', ADMIN_PASSWORD: 'secret' })).toThrow('JWT_SECRET must be set');
    expect(() => validateEnv({ JWT_SECRET: 'jwt-secret', ADMIN_PASSWORD: '   ' })).toThrow('ADMIN_PASSWORD must be set');
  });
});
