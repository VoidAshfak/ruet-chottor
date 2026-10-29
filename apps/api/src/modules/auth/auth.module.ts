import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { SessionsService } from './sessions.service.js';

/** Sign-up, two-step login (password + emailed code), refresh and logout. See docs/modules/auth.md. */
@Module({
  controllers: [AuthController],
  providers: [AuthService, OtpService, SessionsService],
  exports: [SessionsService],
})
export class AuthModule {}
