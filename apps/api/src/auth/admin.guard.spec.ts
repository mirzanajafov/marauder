import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminGuard, SessionRequest } from './admin.guard';
import { AdminSession, AuthService } from './auth.service';

const session: AdminSession = { jti: 'session-1', exp: 2_000_000_000 };

function guarded(authorization?: string) {
  const request: SessionRequest = { headers: { authorization } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { context, request };
}

function guard(verify = jest.fn().mockResolvedValue(session)) {
  return { guard: new AdminGuard({ verify } as unknown as AuthService), verify };
}

describe('AdminGuard', () => {
  it.each(['Bearer good', 'bearer good', 'Bearer   good'])(
    'lets %p through and hands the session on',
    async (header) => {
      const { guard: admin, verify } = guard();
      const { context, request } = guarded(header);

      await expect(admin.canActivate(context)).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('good');
      expect(request.adminSession).toBe(session);
    },
  );

  it('rejects a missing or malformed header without looking at the token', async () => {
    const { guard: admin, verify } = guard();
    for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearergood', 'Bearer good trailing']) {
      await expect(admin.canActivate(guarded(authorization).context)).rejects.toThrow(
        'expected an Authorization: Bearer <token> header',
      );
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it('passes on the reason a token was refused', async () => {
    const { guard: admin } = guard(jest.fn().mockRejectedValue(new UnauthorizedException('token revoked')));
    await expect(admin.canActivate(guarded('Bearer old').context)).rejects.toThrow('token revoked');
  });
});
