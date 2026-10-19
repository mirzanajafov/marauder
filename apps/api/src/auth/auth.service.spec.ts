import { UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';

async function authService(): Promise<AuthService> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AuthModule],
  }).compile();
  return moduleRef.get(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'jwt-secret';
    process.env.ADMIN_PASSWORD = 'secret';
  });

  it('issues an admin token signed with JWT_SECRET for the correct password', async () => {
    const { token } = (await authService()).login('secret');
    expect(new JwtService({ secret: 'jwt-secret' }).verify(token)).toMatchObject({ role: 'admin' });
  });

  it('rejects a wrong password', async () => {
    const service = await authService();
    expect(() => service.login('nope')).toThrow(UnauthorizedException);
  });
});
