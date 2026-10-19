import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const config = new ConfigService({ ADMIN_PASSWORD: 'secret' });

  it('issues a token for the correct password', () => {
    const jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    const service = new AuthService(jwt as never, config);
    const result = service.login('secret');
    expect(result.token).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith({ role: 'admin' });
  });

  it('rejects a wrong password', () => {
    const jwt = { sign: jest.fn() };
    const service = new AuthService(jwt as never, config);
    expect(() => service.login('nope')).toThrow(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
