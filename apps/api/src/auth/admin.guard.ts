import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface BearerRequest {
  headers: { authorization?: string };
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<BearerRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }
    const token = header.slice(7);
    try {
      const payload = this.jwt.verify<{ role?: string }>(token);
      if (payload.role !== 'admin') {
        throw new UnauthorizedException('not an admin token');
      }
      return true;
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }
}
