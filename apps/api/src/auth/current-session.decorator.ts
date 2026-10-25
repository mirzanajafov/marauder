import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { SessionRequest } from './admin.guard';
import { AdminSession } from './auth.service';

export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext): AdminSession => {
  const { adminSession } = context.switchToHttp().getRequest<SessionRequest>();
  if (adminSession === undefined) {
    throw new Error('CurrentSession needs AdminGuard on the route');
  }
  return adminSession;
});
