import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';

function compile(env: Record<string, string>): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }), AuthModule],
  }).compile();
}

describe('AuthModule', () => {
  beforeEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.ADMIN_PASSWORD;
  });

  it('refuses to start without a JWT secret', async () => {
    await expect(compile({ ADMIN_PASSWORD: 'secret' })).rejects.toThrow('JWT_SECRET');
  });

  it('refuses to start without an admin password', async () => {
    await expect(compile({ JWT_SECRET: 'jwt-secret' })).rejects.toThrow('ADMIN_PASSWORD');
  });

  it('signs admin tokens with the configured secret', async () => {
    const moduleRef = await compile({ JWT_SECRET: 'jwt-secret', ADMIN_PASSWORD: 'secret' });
    const { token } = moduleRef.get(AuthService).login('secret');
    expect(new JwtService({ secret: 'jwt-secret' }).verify(token)).toMatchObject({ role: 'admin' });
  });
});
