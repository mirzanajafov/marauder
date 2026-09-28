import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('issues a token for the correct password', () => {
    process.env.ADMIN_PASSWORD = 'secret';
    const jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    const service = new AuthService(jwt as never);
    const result = service.login('secret');
    expect(result.token).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith({ role: 'admin' });
  });

  it('rejects a wrong password', () => {
    process.env.ADMIN_PASSWORD = 'secret';
    const jwt = { sign: jest.fn() };
    const service = new AuthService(jwt as never);
    expect(() => service.login('nope')).toThrow(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
