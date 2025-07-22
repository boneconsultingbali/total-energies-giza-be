import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { Prisma } from "@prisma/client";

export interface BaseIncludeOptions {
  owner?: boolean;
  tenant?: boolean;
  indicators?: boolean;
  statuses?: boolean;
  documents?: boolean;
  profile?: boolean;
  role?: boolean;
  permissions?: boolean;
  _count?: boolean;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  skip?: number;
}

export interface SortOptions {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AccessControlOptions {
  userId: string;
  userRole: string;
  allowedRoles?: string[];
  checkTenantAccess?: boolean;
  checkOwnership?: boolean;
}

@Injectable()
export abstract class BaseService {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected prisma: PrismaService) {}

  /**
   * Execute database operations within a transaction
   */
  protected async executeTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxWait?: number,
    timeout?: number
  ): Promise<T> {
    try {
      this.logger.debug("Starting database transaction");
      const result = await this.prisma.$transaction(operation, {
        maxWait: maxWait || 5000,
        timeout: timeout || 10000,
      });
      this.logger.debug("Transaction completed successfully");
      return result;
    } catch (error) {
      this.logger.error("Transaction failed", error);
      throw error;
    }
  }

  /**
   * Build standardized include options for queries
   */
  protected buildIncludeOptions(options: BaseIncludeOptions = {}): any {
    const include: any = {};

    if (options.owner) {
      include.owner = {
        select: {
          id: true,
          email: true,
          code: true,
          profile: {
            select: {
              first_name: true,
              last_name: true,
              avatar: true,
            },
          },
        },
      };
    }

    if (options.tenant) {
      include.tenant = {
        select: {
          id: true,
          code: true,
          name: true,
          country: true,
          address: true,
        },
      };
    }

    if (options.indicators) {
      include.indicators = {
        include: {
          indicator: {
            select: {
              id: true,
              name: true,
              description: true,
              pillar: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          indicator: {
            name: "asc",
          },
        },
      };
    }

    if (options.statuses) {
      include.statuses = {
        orderBy: { created_at: "desc" },
        take: 10, // Limit status history
      };
    }

    if (options.documents) {
      include.documents = {
        select: {
          id: true,
          name: true,
          description: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 20, // Limit documents
      };
    }

    if (options.profile) {
      include.profile = {
        select: {
          first_name: true,
          last_name: true,
          avatar: true,
          phone: true,
          country: true,
          city: true,
        },
      };
    }

    if (options.role) {
      include.role = {
        select: {
          id: true,
          name: true,
        },
      };
    }

    if (options.permissions) {
      include.role = {
        include: {
          permissions: {
            include: {
              permission: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      };
    }

    if (options._count) {
      include._count = {
        select: {
          indicators: true,
          documents: true,
          statuses: true,
          employees: true,
          projects: true,
        },
      };
    }

    return include;
  }

  /**
   * Build pagination options
   */
  protected buildPaginationOptions(options: PaginationOptions): {
    skip: number;
    take: number;
  } {
    const skip = options.skip ?? (options.page - 1) * options.limit;
    return {
      skip,
      take: options.limit,
    };
  }

  /**
   * Build sort options
   */
  protected buildSortOptions(options: SortOptions = {}): any {
    const { sortBy = "created_at", sortOrder = "desc" } = options;

    // Handle nested sorting
    if (sortBy.includes(".")) {
      const [relation, field] = sortBy.split(".");
      return {
        [relation]: {
          [field]: sortOrder,
        },
      };
    }

    return { [sortBy]: sortOrder };
  }

  /**
   * Build access control conditions
   */
  protected buildAccessControlConditions(options: AccessControlOptions): any[] {
    const conditions = [];
    const { userId, userRole, checkTenantAccess, checkOwnership } = options;

    // Role-based access control
    if (userRole === "user" || userRole === "viewer") {
      const accessConditions = [];

      if (checkOwnership) {
        accessConditions.push({ owner_id: userId });
      }

      if (checkTenantAccess) {
        accessConditions.push({
          tenant: {
            OR: [
              { leader_id: userId },
              { employees: { some: { id: userId } } },
            ],
          },
        });
      }

      if (accessConditions.length > 0) {
        conditions.push({ OR: accessConditions });
      }
    }

    return conditions;
  }

  /**
   * Build search conditions for text search
   */
  protected buildSearchConditions(
    searchTerm: string,
    searchFields: string[]
  ): any {
    if (!searchTerm || searchFields.length === 0) {
      return {};
    }

    const searchConditions = searchFields.map((field) => {
      // Handle nested field search
      if (field.includes(".")) {
        const [relation, relationField] = field.split(".");
        return {
          [relation]: {
            [relationField]: {
              contains: searchTerm,
              mode: "insensitive" as const,
            },
          },
        };
      }

      return {
        [field]: {
          contains: searchTerm,
          mode: "insensitive" as const,
        },
      };
    });

    return { OR: searchConditions };
  }

  /**
   * Build date range conditions
   */
  protected buildDateRangeConditions(
    startDate?: string,
    endDate?: string,
    dateField = "created_at"
  ): any[] {
    const conditions = [];

    if (startDate) {
      conditions.push({
        [dateField]: {
          gte: new Date(startDate),
        },
      });
    }

    if (endDate) {
      conditions.push({
        [dateField]: {
          lte: new Date(endDate),
        },
      });
    }

    return conditions;
  }

  /**
   * Validate entity existence
   */
  protected async validateEntityExists(
    model: any,
    id: string,
    entityName: string
  ): Promise<any> {
    const entity = await model.findUnique({
      where: { id },
    });

    if (!entity) {
      throw new Error(`${entityName} not found`);
    }

    return entity;
  }

  /**
   * Check if user has access to entity
   */
  protected async checkEntityAccess(
    entity: any,
    options: AccessControlOptions
  ): Promise<boolean> {
    const { userId, userRole, checkTenantAccess, checkOwnership } = options;

    // Admin and super admin have full access
    if (["admin", "superadmin"].includes(userRole)) {
      return true;
    }

    // Check ownership
    if (checkOwnership && entity.owner_id === userId) {
      return true;
    }

    // Check tenant access
    if (checkTenantAccess && entity.tenant_id) {
      const hasAccess = await this.checkUserTenantAccess(
        userId,
        entity.tenant_id
      );
      if (hasAccess) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has access to tenant
   */
  protected async checkUserTenantAccess(
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const tenant = await this.prisma.tbm_tenant.findUnique({
        where: { id: tenantId },
        select: {
          leader_id: true,
          employees: {
            select: { id: true },
            where: { id: userId },
          },
        },
      });

      if (!tenant) {
        return false;
      }

      // User is tenant leader or employee
      return tenant.leader_id === userId || tenant.employees.length > 0;
    } catch (error) {
      this.logger.error("Error checking tenant access", error);
      return false;
    }
  }

  /**
   * Calculate pagination metadata
   */
  protected calculatePaginationMeta(
    total: number,
    page: number,
    limit: number
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Validate array fields
   */
  protected validateArrayField(
    value: string | string[],
    fieldName: string
  ): string[] {
    if (!value) return [];

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }

    throw new Error(`Invalid ${fieldName} format`);
  }

  /**
   * Sanitize and validate numeric input
   */
  protected validateNumericInput(
    value: any,
    fieldName: string,
    min?: number,
    max?: number
  ): number {
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      throw new Error(`Invalid ${fieldName}: must be a number`);
    }

    if (min !== undefined && numValue < min) {
      throw new Error(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && numValue > max) {
      throw new Error(`${fieldName} must be at most ${max}`);
    }

    return numValue;
  }

  /**
   * Build cache key for operations
   */
  protected buildCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join("|");

    return `${prefix}:${sortedParams}`;
  }

  /**
   * Log service operation
   */
  protected logOperation(
    operation: string,
    entityId?: string,
    userId?: string
  ): void {
    this.logger.log(
      `${operation}${entityId ? ` - Entity: ${entityId}` : ""}${
        userId ? ` - User: ${userId}` : ""
      }`
    );
  }
}
