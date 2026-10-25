import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminSession, AuthService } from './auth.service';

export interface SessionRequest {
  headers: { authorization?: string };
  adminSession?: AdminSession;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = /^Bearer +(\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (token === undefined) {
      throw new UnauthorizedException('expected an Authorization: Bearer <token> header');
    }
    request.adminSession = await this.auth.verify(token);
    return true;
  }
}
