import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminSession {
  jti: string;
  exp: number;
}

interface Claims {
  role?: string;
  jti?: string;
  exp?: number;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

@Injectable()
export class AuthService {
  private readonly adminPassword: Buffer;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.adminPassword = digest(config.get('ADMIN_PASSWORD', { infer: true }));
  }

  login(password: string): { token: string } {
    if (!timingSafeEqual(digest(password), this.adminPassword)) {
      throw new UnauthorizedException('invalid password');
    }
    return { token: this.jwt.sign({ role: 'admin' }, { jwtid: randomUUID() }) };
  }

  async verify(token: string): Promise<AdminSession> {
    let claims: Claims;
    try {
      claims = this.jwt.verify<Claims>(token);
    } catch {
      throw new UnauthorizedException('invalid token');
    }
    const { role, jti, exp } = claims;
    if (role !== 'admin') {
      throw new UnauthorizedException('not an admin token');
    }
    if (jti === undefined || exp === undefined) {
      throw new UnauthorizedException('token has no session id or expiry, log in again');
    }
    if (await this.prisma.revokedToken.findUnique({ where: { jti } })) {
      throw new UnauthorizedException('token revoked');
    }
    return { jti, exp };
  }

  async revoke({ jti, exp }: AdminSession): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.prisma.revokedToken.createMany({ data: [{ jti, expiresAt: new Date(exp * 1000) }], skipDuplicates: true }),
    ]);
  }
}
