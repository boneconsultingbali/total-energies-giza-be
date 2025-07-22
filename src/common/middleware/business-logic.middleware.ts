import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EmailService } from "../../email/email.service";

export interface EntityValidationResult {
  isValid: boolean;
  entity?: any;
  error?: string;
}

export interface NotificationConfig {
  email?: boolean;
  internal?: boolean;
  delay?: number;
}

@Injectable()
export class BusinessLogicMiddleware {
  private readonly logger = new Logger(BusinessLogicMiddleware.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  /**
   * Validate user entity and permissions
   */
  async validateUser(
    userId: string,
    options: {
      checkActive?: boolean;
      checkDeleted?: boolean;
      requiredRole?: string;
      includeProfile?: boolean;
    } = {}
  ): Promise<EntityValidationResult> {
    try {
      const {
        checkActive = true,
        checkDeleted = true,
        requiredRole,
        includeProfile = false,
      } = options;

      const user = await this.prisma.tbm_user.findUnique({
        where: { id: userId },
        include: {
          profile: includeProfile,
          role: !!requiredRole,
        },
      });

      if (!user) {
        return { isValid: false, error: "User not found" };
      }

      if (checkDeleted && user.is_deleted) {
        return { isValid: false, error: "User is deleted" };
      }

      if (checkActive && !user.is_active) {
        return { isValid: false, error: "User is inactive" };
      }

      if (requiredRole && user.role_name !== requiredRole) {
        return { isValid: false, error: "Insufficient permissions" };
      }

      return { isValid: true, entity: user };
    } catch (error) {
      this.logger.error("Error validating user", error);
      return { isValid: false, error: "Validation failed" };
    }
  }

  /**
   * Validate tenant entity and user access
   */
  async validateTenant(
    tenantId: string,
    userId?: string,
    options: {
      checkLeadership?: boolean;
      checkMembership?: boolean;
    } = {}
  ): Promise<EntityValidationResult> {
    try {
      const { checkLeadership = false, checkMembership = false } = options;

      const tenant = await this.prisma.tbm_tenant.findUnique({
        where: { id: tenantId },
        include: {
          leader: checkLeadership || checkMembership,
          employees: checkMembership ? { where: { id: userId } } : false,
        },
      });

      if (!tenant) {
        return { isValid: false, error: "Tenant not found" };
      }

      if (userId) {
        if (checkLeadership && tenant.leader_id !== userId) {
          return { isValid: false, error: "User is not tenant leader" };
        }

        if (checkMembership) {
          const isMember =
            tenant.leader_id === userId ||
            (tenant.employees && tenant.employees.length > 0);
          if (!isMember) {
            return { isValid: false, error: "User is not tenant member" };
          }
        }
      }

      return { isValid: true, entity: tenant };
    } catch (error) {
      this.logger.error("Error validating tenant", error);
      return { isValid: false, error: "Validation failed" };
    }
  }

  /**
   * Validate project entity and user access
   */
  async validateProject(
    projectId: string,
    userId?: string,
    userRole?: string,
    options: {
      checkOwnership?: boolean;
      checkTenantAccess?: boolean;
      includeRelations?: boolean;
    } = {}
  ): Promise<EntityValidationResult> {
    try {
      const {
        checkOwnership = false,
        checkTenantAccess = false,
        includeRelations = false,
      } = options;

      const project = await this.prisma.tbm_project.findUnique({
        where: { id: projectId },
        include: {
          owner: includeRelations,
          tenant: includeRelations || checkTenantAccess,
          indicators: includeRelations,
          statuses: includeRelations,
          documents: includeRelations,
        },
      });

      if (!project) {
        return { isValid: false, error: "Project not found" };
      }

      if (userId && userRole) {
        // Admin and super admin have full access
        if (["admin", "superadmin"].includes(userRole)) {
          return { isValid: true, entity: project };
        }

        let hasAccess = false;

        // Check ownership
        if (checkOwnership && project.owner_id === userId) {
          hasAccess = true;
        }

        // Check tenant access
        if (checkTenantAccess && project.tenant_id) {
          const tenantValidation = await this.validateTenant(
            project.tenant_id,
            userId,
            { checkMembership: true }
          );
          if (tenantValidation.isValid) {
            hasAccess = true;
          }
        }

        if (!hasAccess && (checkOwnership || checkTenantAccess)) {
          return { isValid: false, error: "Access denied to project" };
        }
      }

      return { isValid: true, entity: project };
    } catch (error) {
      this.logger.error("Error validating project", error);
      return { isValid: false, error: "Validation failed" };
    }
  }

  /**
   * Validate performance indicator entity
   */
  async validatePerformanceIndicator(
    indicatorId: string,
    options: {
      checkActive?: boolean;
      includeParent?: boolean;
    } = {}
  ): Promise<EntityValidationResult> {
    try {
      const { checkActive = false, includeParent = false } = options;

      const indicator = await this.prisma.tbm_performance_indicator.findUnique({
        where: { id: indicatorId },
        include: {
          parent: includeParent,
        },
      });

      if (!indicator) {
        return { isValid: false, error: "Performance indicator not found" };
      }

      if (checkActive && indicator.is_grey) {
        return { isValid: false, error: "Performance indicator is inactive" };
      }

      return { isValid: true, entity: indicator };
    } catch (error) {
      this.logger.error("Error validating performance indicator", error);
      return { isValid: false, error: "Validation failed" };
    }
  }

  /**
   * Calculate project score based on indicators
   */
  async calculateProjectScore(projectId: string): Promise<number | null> {
    try {
      const indicators =
        await this.prisma.tbs_project_performance_indicator.findMany({
          where: { project_id: projectId },
          select: { score: true },
        });

      if (indicators.length === 0) {
        return null;
      }

      const validScores = indicators
        .filter((i) => i.score !== null)
        .map((i) => Number(i.score));

      if (validScores.length === 0) {
        return null;
      }

      const averageScore =
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
      return Math.round(averageScore * 100) / 100;
    } catch (error) {
      this.logger.error("Error calculating project score", error);
      return null;
    }
  }

  /**
   * Update project score
   */
  async updateProjectScore(projectId: string, tx?: any): Promise<void> {
    try {
      const client = tx || this.prisma;
      const newScore = await this.calculateProjectScore(projectId);

      if (newScore !== null) {
        await client.tbm_project.update({
          where: { id: projectId },
          data: { score: newScore },
        });
      }
    } catch (error) {
      this.logger.error("Error updating project score", error);
    }
  }

  /**
   * Create project status entry
   */
  async createProjectStatus(
    projectId: string,
    status: string,
    description: string,
    tx?: any
  ): Promise<any> {
    try {
      const client = tx || this.prisma;

      return await client.tbs_project_status.create({
        data: {
          project_id: projectId,
          status,
          description,
        },
      });
    } catch (error) {
      this.logger.error("Error creating project status", error);
      throw error;
    }
  }

  /**
   * Send notification with configurable options
   */
  async sendNotification(
    type: "email" | "internal" | "both",
    config: {
      template: string;
      recipient: string;
      recipientName?: string;
      subject?: string;
      data: Record<string, any>;
      delay?: number;
    }
  ): Promise<void> {
    const sendNotificationAsync = async () => {
      try {
        if (type === "email" || type === "both") {
          switch (config.template) {
            case "welcome":
              await this.emailService.sendWelcomeEmail({
                email: config.recipient,
                name: config.recipientName || config.recipient,
                temporaryPassword: config.data.password,
              });
              break;

            case "project-status-update":
              await this.emailService.sendProjectStatusUpdateEmail({
                email: config.recipient,
                name: config.recipientName || config.recipient,
                projectName: config.data.projectName,
                oldStatus: config.data.oldStatus,
                newStatus: config.data.newStatus,
                description: config.data.description,
              });
              break;

            case "password-reset":
              await this.emailService.sendPasswordResetEmail({
                email: config.recipient,
                name: config.recipientName || config.recipient,
                resetToken: config.data.resetToken,
              });
              break;

            case "password-changed":
              await this.emailService.sendPasswordChangedEmail({
                email: config.recipient,
                name: config.recipientName || config.recipient,
              });
              break;

            default:
              this.logger.warn(`Unknown email template: ${config.template}`);
          }
        }

        if (type === "internal" || type === "both") {
          // Log internal notification or send to internal notification system
          this.logger.log(
            `Internal notification sent to ${config.recipient}: ${config.template}`
          );
        }
      } catch (error) {
        this.logger.error(`Failed to send ${type} notification`, error);
      }
    };

    if (config.delay && config.delay > 0) {
      setTimeout(sendNotificationAsync, config.delay);
    } else {
      setImmediate(sendNotificationAsync);
    }
  }

  /**
   * Validate and sanitize array input
   */
  validateArrayInput(input: any, fieldName: string, maxLength = 100): string[] {
    if (!input) return [];

    let array: string[];

    if (typeof input === "string") {
      array = input.split(",").map((item) => item.trim());
    } else if (Array.isArray(input)) {
      array = input.map((item) => String(item).trim());
    } else {
      throw new Error(`Invalid ${fieldName} format`);
    }

    // Filter out empty values and limit length
    array = array.filter((item) => item.length > 0).slice(0, maxLength);

    return array;
  }

  /**
   * Validate and sanitize numeric input
   */
  validateNumericInput(
    value: any,
    fieldName: string,
    options: {
      min?: number;
      max?: number;
      decimals?: number;
      required?: boolean;
    } = {}
  ): number | null {
    const { min, max, decimals, required = false } = options;

    if (value === null || value === undefined || value === "") {
      if (required) {
        throw new Error(`${fieldName} is required`);
      }
      return null;
    }

    const numValue =
      typeof value === "string" ? parseFloat(value) : Number(value);

    if (isNaN(numValue)) {
      throw new Error(`Invalid ${fieldName}: must be a number`);
    }

    if (min !== undefined && numValue < min) {
      throw new Error(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && numValue > max) {
      throw new Error(`${fieldName} must be at most ${max}`);
    }

    if (decimals !== undefined) {
      return (
        Math.round(numValue * Math.pow(10, decimals)) / Math.pow(10, decimals)
      );
    }

    return numValue;
  }

  /**
   * Validate date input
   */
  validateDateInput(
    value: any,
    fieldName: string,
    required = false
  ): Date | null {
    if (!value) {
      if (required) {
        throw new Error(`${fieldName} is required`);
      }
      return null;
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}: must be a valid date`);
    }

    return date;
  }

  /**
   * Validate email format
   */
  validateEmailInput(email: string, required = true): string | null {
    if (!email) {
      if (required) {
        throw new Error("Email is required");
      }
      return null;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    return email.toLowerCase().trim();
  }

  /**
   * Check uniqueness of field value
   */
  async checkUniqueness(
    model: string,
    field: string,
    value: any,
    excludeId?: string
  ): Promise<boolean> {
    try {
      const where: any = { [field]: value };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const count = await (this.prisma as any)[model].count({ where });
      return count === 0;
    } catch (error) {
      this.logger.error("Error checking uniqueness", error);
      throw new Error("Failed to check field uniqueness");
    }
  }

  /**
   * Get entity statistics
   */
  async getEntityStatistics(
    model: string,
    filters: Record<string, any> = {},
    groupBy?: string[]
  ): Promise<any> {
    try {
      if (groupBy && groupBy.length > 0) {
        return await (this.prisma as any)[model].groupBy({
          by: groupBy,
          where: filters,
          _count: true,
        });
      } else {
        return await (this.prisma as any)[model].count({
          where: filters,
        });
      }
    } catch (error) {
      this.logger.error("Error getting entity statistics", error);
      throw new Error("Failed to get statistics");
    }
  }

  /**
   * Audit log helper
   */
  async createAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    changes?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // This could be extended to create audit log entries
      this.logger.log(
        `Audit: ${action} ${entityType} ${entityId} by user ${userId}`,
        {
          changes,
          metadata,
        }
      );
    } catch (error) {
      this.logger.error("Error creating audit log", error);
    }
  }
}
