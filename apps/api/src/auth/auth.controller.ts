import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminGuard } from './admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto): { token: string } {
    return this.auth.login(body.password);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(): { role: string } {
    return { role: 'admin' };
  }
}
