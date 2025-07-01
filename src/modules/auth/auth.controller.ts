import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Param,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "../../common/guards/local-auth.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Request() req, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user, req.ip, req.get("User-Agent"));
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body("email") email: string) {
    await this.authService.forgotPassword(email);
    return { message: "Password reset email sent if account exists" };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body("token") token: string,
    @Body("password") password: string
  ) {
    await this.authService.resetPassword(token, password);
    return { message: "Password reset successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body("currentPassword") currentPassword: string,
    @Body("newPassword") newPassword: string
  ) {
    await this.authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );
    return { message: "Password changed successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    await this.authService.logout(req.user.id);
    return { message: "Logged out successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Get("login-history")
  async getLoginHistory(@Request() req) {
    return this.authService.getLoginHistory(req.user.id);
  }
}
