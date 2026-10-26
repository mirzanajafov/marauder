import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import { AdminGuard, SessionRequest } from './admin.guard';
import { AdminSession, AuthService } from './auth.service';

const session: AdminSession = { jti: 'session-1', exp: 2_000_000_000 };

async function adminGuard(verify = jest.fn().mockResolvedValue(session)) {
  const moduleRef = await Test.createTestingModule({
    providers: [AdminGuard, { provide: AuthService, useValue: { verify } }],
  }).compile();
  return { guard: moduleRef.get(AdminGuard), verify };
}

function requestWith(authorization?: string): SessionRequest {
  return { headers: { authorization } };
}

describe('AdminGuard', () => {
  it.each(['Bearer good', 'bearer good', 'Bearer   good'])(
    'lets %p through and hands the session on',
    async (header) => {
      const { guard, verify } = await adminGuard();
      const request = requestWith(header);

      await expect(guard.canActivate(new ExecutionContextHost([request]))).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('good');
      expect(request.adminSession).toBe(session);
    },
  );

  it('rejects a missing or malformed header without looking at the token', async () => {
    const { guard, verify } = await adminGuard();
    for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearergood', 'Bearer good trailing']) {
      await expect(guard.canActivate(new ExecutionContextHost([requestWith(authorization)]))).rejects.toThrow(
        'expected an Authorization: Bearer <token> header',
      );
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it('passes on the reason a token was refused', async () => {
    const { guard } = await adminGuard(jest.fn().mockRejectedValue(new UnauthorizedException('token revoked')));
    await expect(guard.canActivate(new ExecutionContextHost([requestWith('Bearer old')]))).rejects.toThrow(
      'token revoked',
    );
  });
});
