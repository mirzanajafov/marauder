import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function context(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('allows a valid admin token', () => {
    const jwt = { verify: jest.fn().mockReturnValue({ role: 'admin' }) };
    const guard = new AdminGuard(jwt as never);
    expect(guard.canActivate(context('Bearer good'))).toBe(true);
  });

  it('rejects a missing header', () => {
    const jwt = { verify: jest.fn() };
    const guard = new AdminGuard(jwt as never);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('rejects a non-admin token', () => {
    const jwt = { verify: jest.fn().mockReturnValue({ role: 'user' }) };
    const guard = new AdminGuard(jwt as never);
    expect(() => guard.canActivate(context('Bearer x'))).toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', () => {
    const jwt = {
      verify: jest.fn(() => {
        throw new Error('bad');
      }),
    };
    const guard = new AdminGuard(jwt as never);
    expect(() => guard.canActivate(context('Bearer x'))).toThrow(UnauthorizedException);
  });
});
