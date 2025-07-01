import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailClient } from "@azure/communication-email";
import * as Handlebars from "handlebars";
import { readFileSync } from "fs";
import * as path from "path";

export interface EmailTemplate {
  subject: string;
  templateName: string;
  data: Record<string, any>;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailOptions {
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: string;
}

export interface PasswordResetEmailData {
  email: string;
  name: string;
  resetToken: string;
  resetUrl?: string;
}

export interface WelcomeEmailData {
  email: string;
  name: string;
  temporaryPassword?: string;
}

export interface PasswordChangedEmailData {
  email: string;
  name: string;
}

export interface AccountLockedEmailData {
  email: string;
  name: string;
  lockDuration: string;
}

export interface ProjectStatusUpdateEmailData {
  email: string;
  name: string;
  projectName: string;
  oldStatus: string;
  newStatus: string;
  description?: string;
}

export interface TestEmailData {
  email: string;
  name?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailClient: EmailClient;
  private readonly senderAddress: string;

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      "AZURE_COMMUNICATION_CONNECTION_STRING"
    );
    this.senderAddress = this.configService.get<string>(
      "EMAIL_SENDER_ADDRESS",
      "DoNotReply@giza-totalenergies.com"
    );

    if (!connectionString) {
      this.logger.warn(
        "Azure Communication Services connection string not configured. Email functionality will be disabled."
      );
      return;
    }

    this.emailClient = new EmailClient(connectionString);
    this.logger.log(
      "Email service initialized with Azure Communication Services"
    );
  }

  async sendEmail(
    recipients: EmailRecipient[],
    template: EmailTemplate,
    options?: EmailOptions
  ): Promise<boolean> {
    if (!this.emailClient) {
      this.logger.warn("Email client not initialized. Skipping email send.");
      return false;
    }

    try {
      const { html, plainText } = await this.renderTemplate(
        template.templateName,
        template.data
      );

      const emailMessage = {
        senderAddress: this.senderAddress,
        content: {
          subject: template.subject,
          plainText,
          html,
        },
        recipients: {
          to: recipients.map((recipient) => ({
            address: recipient.email,
            displayName: recipient.name,
          })),
          ...(options?.cc && {
            cc: options.cc.map((recipient) => ({
              address: recipient.email,
              displayName: recipient.name,
            })),
          }),
          ...(options?.bcc && {
            bcc: options.bcc.map((recipient) => ({
              address: recipient.email,
              displayName: recipient.name,
            })),
          }),
        },
        ...(options?.replyTo && {
          replyTo: [{ address: options.replyTo }],
        }),
      };

      this.logger.log(
        `Sending email to ${recipients.length} recipient(s): ${template.subject}`
      );

      const poller = await this.emailClient.beginSend(emailMessage);
      const result = await poller.pollUntilDone();

      if (result.status === "Succeeded") {
        this.logger.log(`Email sent successfully. Message ID: ${result.id}`);
        return true;
      } else {
        this.logger.error(
          `Email sending failed. Status: ${result.status}`,
          result.error
        );
        return false;
      }
    } catch (error) {
      this.logger.error("Failed to send email", error.stack);
      return false;
    }
  }

  async sendPasswordResetEmail(
    data: PasswordResetEmailData,
    options?: EmailOptions
  ): Promise<boolean> {
    const baseUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000"
    );
    const resetLink =
      data.resetUrl || `${baseUrl}/reset-password?token=${data.resetToken}`;

    return this.sendEmail(
      [{ email: data.email, name: data.name }],
      {
        subject: "Password Reset Request - Total Energies Giza",
        templateName: "password-reset",
        data: {
          name: data.name,
          resetLink,
          resetToken: data.resetToken,
          expiryTime: "1 hour",
          supportEmail: this.configService.get<string>(
            "SUPPORT_EMAIL",
            "support@giza-totalenergies.com"
          ),
          companyName: "Total Energies Giza",
          currentYear: new Date().getFullYear(),
        },
      },
      options
    );
  }

  async sendWelcomeEmail(
    data: WelcomeEmailData,
    options?: EmailOptions
  ): Promise<boolean> {
    const loginUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000"
    );

    return this.sendEmail(
      [{ email: data.email, name: data.name }],
      {
        subject: "Welcome to Total Energies Giza Platform",
        templateName: "welcome",
        data: {
          name: data.name,
          email: data.email,
          temporaryPassword: data.temporaryPassword,
          loginUrl,
          supportEmail: this.configService.get<string>(
            "SUPPORT_EMAIL",
            "support@giza-totalenergies.com"
          ),
          companyName: "Total Energies Giza",
          currentYear: new Date().getFullYear(),
        },
      },
      options
    );
  }

  async sendPasswordChangedEmail(
    data: PasswordChangedEmailData,
    options?: EmailOptions
  ): Promise<boolean> {
    return this.sendEmail(
      [{ email: data.email, name: data.name }],
      {
        subject: "Password Changed Successfully - Total Energies Giza",
        templateName: "password-changed",
        data: {
          name: data.name,
          changeTime: new Date().toLocaleString(),
          supportEmail: this.configService.get<string>(
            "SUPPORT_EMAIL",
            "support@giza-totalenergies.com"
          ),
          companyName: "Total Energies Giza",
          currentYear: new Date().getFullYear(),
        },
      },
      options
    );
  }

  async sendAccountLockedEmail(
    data: AccountLockedEmailData,
    options?: EmailOptions
  ): Promise<boolean> {
    return this.sendEmail(
      [{ email: data.email, name: data.name }],
      {
        subject: "Account Temporarily Locked - Total Energies Giza",
        templateName: "account-locked",
        data: {
          name: data.name,
          lockDuration: data.lockDuration,
          lockTime: new Date().toLocaleString(),
          supportEmail: this.configService.get<string>(
            "SUPPORT_EMAIL",
            "support@giza-totalenergies.com"
          ),
          companyName: "Total Energies Giza",
          currentYear: new Date().getFullYear(),
        },
      },
      options
    );
  }

  async sendProjectStatusUpdateEmail(
    data: ProjectStatusUpdateEmailData,
    options?: EmailOptions
  ): Promise<boolean> {
    const projectUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000"
    );

    return this.sendEmail(
      [{ email: data.email, name: data.name }],
      {
        subject: `Project Status Update: ${data.projectName} - Total Energies Giza`,
        templateName: "project-status-update",
        data: {
          name: data.name,
          projectName: data.projectName,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          description: data.description,
          updateTime: new Date().toLocaleString(),
          projectUrl,
          companyName: "Total Energies Giza",
          currentYear: new Date().getFullYear(),
        },
      },
      options
    );
  }

  async sendTestEmail(
    data: TestEmailData,
    options?: EmailOptions
  ): Promise<boolean> {
    return this.sendEmail(
      [{ email: data.email, name: data.name || "Test User" }],
      {
        subject: "Test Email - Total Energies Giza",
        templateName: "test",
        data: {
          name: data.name || "Test User",
          testTime: new Date().toLocaleString(),
          companyName: "Total Energies Giza",
          currentYear: new Date().getFullYear(),
        },
      },
      options
    );
  }

  private async renderTemplate(
    templateName: string,
    data: Record<string, any>
  ): Promise<{ html: string; plainText: string }> {
    try {
      // Load HTML template
      const htmlTemplatePath = path.join(
        process.cwd(),
        "public",
        "templates",
        `${templateName}.html`
      );
      const htmlSource = readFileSync(htmlTemplatePath, { encoding: "utf-8" });
      const htmlTemplate = Handlebars.compile(htmlSource);
      const html = htmlTemplate(data);

      // Load plain text template (optional)
      let plainText = "";
      try {
        const textTemplatePath = path.join(
          process.cwd(),
          "public",
          "templates",
          `${templateName}.txt`
        );
        const textSource = readFileSync(textTemplatePath, {
          encoding: "utf-8",
        });
        const textTemplate = Handlebars.compile(textSource);
        plainText = textTemplate(data);
      } catch (error) {
        // If no text template exists, create a basic plain text version
        plainText = this.htmlToPlainText(html);
      }

      return { html, plainText };
    } catch (error) {
      this.logger.error(
        `Failed to render email template: ${templateName}`,
        error.stack
      );
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  private htmlToPlainText(html: string): string {
    // Basic HTML to plain text conversion
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
      .replace(/&/g, "&") // Replace HTML entities
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim();
  }
}
