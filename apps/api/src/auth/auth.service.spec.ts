import { UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';

const JWT_SECRET = 'a-test-secret-that-is-long-enough!';
const ADMIN_PASSWORD = 'correct-horse-battery';

function revocationTable() {
  const revoked = new Set<string>();
  const revokedToken = {
    findUnique: ({ where }: { where: { jti: string } }) => Promise.resolve(revoked.has(where.jti) ? where : null),
  };
  return { prisma: { revokedToken }, revoked };
}

async function authService() {
  const table = revocationTable();
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: () => ({ JWT_SECRET, ADMIN_PASSWORD }),
      }),
      PrismaModule,
      AuthModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(table.prisma)
    .compile();
  return { service: moduleRef.get(AuthService), revoked: table.revoked };
}

describe('AuthService', () => {
  it('issues an admin token with its own id, signed with JWT_SECRET, for the correct password', async () => {
    const { service } = await authService();
    const { token } = service.login(ADMIN_PASSWORD);
    const payload = new JwtService({ secret: JWT_SECRET }).verify<{ role: string; jti: string }>(token);
    expect(payload.role).toBe('admin');
    expect(typeof payload.jti).toBe('string');
  });

  it('rejects a wrong password, including one that only shares a prefix', async () => {
    const { service } = await authService();
    expect(() => service.login('nope')).toThrow(UnauthorizedException);
    expect(() => service.login(`${ADMIN_PASSWORD}-staple`)).toThrow(UnauthorizedException);
  });

  it('accepts its own token and rejects a forged, non-admin, id-less or never-expiring one', async () => {
    const { service } = await authService();
    const { token } = service.login(ADMIN_PASSWORD);
    const session = await service.verify(token);
    expect(Object.keys(session).sort()).toEqual(['exp', 'jti']);
    expect(session.exp).toBeGreaterThan(Date.now() / 1000);

    const forged = new JwtService({ secret: 'some-other-secret-of-the-same-size!' }).sign({ role: 'admin', jti: 'x' });
    await expect(service.verify(forged)).rejects.toThrow('invalid token');
    const viewer = new JwtService({ secret: JWT_SECRET }).sign({ role: 'viewer', jti: 'x' });
    await expect(service.verify(viewer)).rejects.toThrow('not an admin token');
    const beforeSessions = new JwtService({ secret: JWT_SECRET }).sign({ role: 'admin' }, { expiresIn: '1h' });
    await expect(service.verify(beforeSessions)).rejects.toThrow('token has no session id or expiry, log in again');
    const neverExpires = new JwtService({ secret: JWT_SECRET }).sign({ role: 'admin', jti: 'x' });
    await expect(service.verify(neverExpires)).rejects.toThrow('token has no session id or expiry, log in again');
  });

  it('refuses a token whose session id is on the revocation list', async () => {
    const { service, revoked } = await authService();
    const { token } = service.login(ADMIN_PASSWORD);
    const { jti } = await service.verify(token);

    revoked.add(jti);

    await expect(service.verify(token)).rejects.toThrow('token revoked');
  });
});
