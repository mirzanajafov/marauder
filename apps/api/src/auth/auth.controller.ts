import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminSession, AuthService } from './auth.service';
import { CurrentSession } from './current-session.decorator';
import { LoginDto } from './dto/login.dto';
import { AdminGuard } from './admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  login(@Body() body: LoginDto): { token: string } {
    return this.auth.login(body.password);
  }

  @Post('logout')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  logout(@CurrentSession() session: AdminSession): Promise<void> {
    return this.auth.revoke(session);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(): { role: string } {
    return { role: 'admin' };
  }
}
