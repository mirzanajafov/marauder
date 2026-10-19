import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly adminPassword: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.adminPassword = config.getOrThrow<string>('ADMIN_PASSWORD');
  }

  login(password: string): { token: string } {
    if (password !== this.adminPassword) {
      throw new UnauthorizedException('invalid password');
    }
    return { token: this.jwt.sign({ role: 'admin' }) };
  }
}
