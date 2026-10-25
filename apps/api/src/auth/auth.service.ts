import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class AuthService {
  private readonly adminPassword: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.adminPassword = config.get('ADMIN_PASSWORD', { infer: true });
  }

  login(password: string): { token: string } {
    if (password !== this.adminPassword) {
      throw new UnauthorizedException('invalid password');
    }
    return { token: this.jwt.sign({ role: 'admin' }) };
  }
}
