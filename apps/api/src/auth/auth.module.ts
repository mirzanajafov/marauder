import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  providers: [AuthService, AdminGuard],
  controllers: [AuthController],
  exports: [AdminGuard, JwtModule],
})
export class AuthModule {}
