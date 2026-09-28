import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  login(password: string): { token: string } {
    const expected = process.env.ADMIN_PASSWORD ?? 'marauder';
    if (password !== expected) {
      throw new UnauthorizedException('invalid password');
    }
    return { token: this.jwt.sign({ role: 'admin' }) };
  }
}
