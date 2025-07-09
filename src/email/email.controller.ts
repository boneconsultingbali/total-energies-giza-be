import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from "@nestjs/common";
import { EmailService, TestEmailData } from "./email.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { Role } from "@/constants/role";

@Controller("email")
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post("test")
  async sendTestEmail(@Body() testEmailData: TestEmailData, @Request() req) {
    // Only admin and superadmin can send test emails
    const userRole = req.user.role?.name;
    if (!userRole || ![Role.Admin, Role.StandardUser].includes(userRole)) {
      throw new ForbiddenException(
        "Only admin and standard user can send test emails"
      );
    }

    const success = await this.emailService.sendTestEmail(testEmailData);

    return {
      message: success
        ? "Test email sent successfully"
        : "Failed to send test email",
      success,
    };
  }
}
