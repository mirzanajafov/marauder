import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

@Injectable()
export class AuthService {
  private readonly adminPassword: Buffer;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.adminPassword = digest(config.get('ADMIN_PASSWORD', { infer: true }));
  }

  login(password: string): { token: string } {
    if (!timingSafeEqual(digest(password), this.adminPassword)) {
      throw new UnauthorizedException('invalid password');
    }
    return { token: this.jwt.sign({ role: 'admin' }) };
  }
}
