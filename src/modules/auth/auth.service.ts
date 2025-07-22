import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EmailService } from "@/email/email.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.tbm_user.findFirst({
      where: {
        OR: [{ email: email }, { code: email }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        profile: true,
      },
    });

    if (!user) {
      // Log failed attempt
      await this.logLoginAttempt(null, email, false, "User not found");
      return null;
    }

    // Check if user is locked
    if (user.locked_until && new Date() < user.locked_until) {
      await this.logLoginAttempt(user.id, email, false, "Account locked");
      throw new UnauthorizedException("Account is temporarily locked");
    }

    // Check if user is active
    if (!user.is_active || user.is_deleted) {
      await this.logLoginAttempt(user.id, email, false, "Account inactive");
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, email);
      return null;
    }

    // Reset login attempts on successful login
    await this.prisma.tbm_user.update({
      where: { id: user.id },
      data: {
        login_attempts: 0,
        locked_until: null,
        last_login: new Date(),
      },
    });

    const { password: _password, ...result } = user;
    return result;
  }

  async login(user: any, ipAddress?: string, userAgent?: string) {
    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    // Save session
    await this.prisma.tbm_user_session.create({
      data: {
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log successful login
    await this.logLoginAttempt(
      user.id,
      user.email,
      true,
      null,
      ipAddress,
      userAgent
    );

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        code: user.code,
        role: user.role,
        permissions:
          user.role?.permissions.map((rp) => rp.permission.name) || [],
        profile: user.profile,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.tbm_user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user || !user.is_active || user.is_deleted) {
      // Don't reveal whether user exists or not
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.tbm_user.update({
      where: { id: user.id },
      data: {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires,
      },
    });

    // Send password reset email
    const userName = user.profile?.first_name
      ? `${user.profile.first_name} ${user.profile.last_name || ""}`.trim()
      : user.email;

    await this.emailService.sendPasswordResetEmail({
      email: user.email,
      name: userName,
      resetToken,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.tbm_user.findFirst({
      where: {
        reset_token: token,
        reset_token_expires: {
          gt: new Date(),
        },
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.tbm_user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        login_attempts: 0,
        locked_until: null,
      },
    });

    // Send password changed confirmation email
    const userName = user.profile?.first_name
      ? `${user.profile.first_name} ${user.profile.last_name || ""}`.trim()
      : user.email;

    await this.emailService.sendPasswordChangedEmail({
      email: user.email,
      name: userName,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await this.prisma.tbm_user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.tbm_user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    // Send password changed confirmation email
    const userName = user.profile?.first_name
      ? `${user.profile.first_name} ${user.profile.last_name || ""}`.trim()
      : user.email;

    await this.emailService.sendPasswordChangedEmail({
      email: user.email,
      name: userName,
    });
  }

  async logout(userId: string) {
    await this.prisma.tbm_user_session.deleteMany({
      where: { user_id: userId },
    });
  }

  async getLoginHistory(userId: string, limit = 50) {
    return this.prisma.tbm_login_log.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        id: true,
        ip_address: true,
        user_agent: true,
        success: true,
        reason: true,
        created_at: true,
      },
    });
  }

  private async handleFailedLogin(userId: string, email: string) {
    const maxAttempts = this.configService.get("MAX_LOGIN_ATTEMPTS", 5);
    const lockTime = this.configService.get("LOCK_TIME", 30); // minutes

    const user = await this.prisma.tbm_user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    const newAttempts = user.login_attempts + 1;
    const shouldLock = newAttempts >= maxAttempts;

    await this.prisma.tbm_user.update({
      where: { id: userId },
      data: {
        login_attempts: newAttempts,
        locked_until: shouldLock
          ? new Date(Date.now() + lockTime * 60 * 1000)
          : null,
      },
    });

    await this.logLoginAttempt(
      userId,
      email,
      false,
      shouldLock
        ? "Account locked due to too many failed attempts"
        : "Invalid password"
    );

    // Send account locked email if account was locked
    if (shouldLock) {
      const userName = user.profile?.first_name
        ? `${user.profile.first_name} ${user.profile.last_name || ""}`.trim()
        : user.email;

      await this.emailService.sendAccountLockedEmail({
        email: user.email,
        name: userName,
        lockDuration: `${lockTime} minutes`,
      });
    }
  }

  private async logLoginAttempt(
    userId: string | null,
    email: string,
    success: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (userId) {
      await this.prisma.tbm_login_log.create({
        data: {
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
          success,
          reason,
        },
      });
    }
  }
}
