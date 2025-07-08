import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";
import { EmailService } from "@/email/email.service";

interface UserSearchQuery extends PaginationDto {
  role?: string;
  active?: string;
  q?: string;
}

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  async checkExistingCode(code: string, previous_code?: string) {
    if (code === previous_code) return;

    // Check if the new code already exists in the database
    const existingCode = await this.prisma.tbm_user.findUnique({
      where: { code },
    });

    if (existingCode) return false;

    return true;
  }

  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const isCodeUnique = await this.checkExistingCode(createUserDto.code);
    if (!isCodeUnique) {
      throw new ConflictException("Code already exists");
    }

    const existingUser = await this.prisma.tbm_user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Validate role exists and is valid
    if (createUserDto.role_name) {
      const role = await this.prisma.tbm_role.findUnique({
        where: { name: createUserDto.role_name },
      });
      if (!role) {
        throw new BadRequestException("Invalid role specified");
      }

      // Validate role hierarchy - only superadmin can create superadmin users
      if (createUserDto.role_name === "superadmin") {
        throw new BadRequestException(
          "Superadmin users can only be created by system initialization"
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user with profile
    const user = await this.prisma.tbm_user.create({
      data: {
        code: createUserDto.code,
        email: createUserDto.email,
        password: hashedPassword,
        role_name: createUserDto.role_name || "user", // Default to user role
        is_active: createUserDto.is_active ?? true,
        profile: createUserDto.profile
          ? {
              create: createUserDto.profile,
            }
          : undefined,
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

    // Send welcome email
    const userName = user.profile?.first_name
      ? `${user.profile.first_name} ${user.profile.last_name || ""}`.trim()
      : user.email;

    await this.emailService.sendWelcomeEmail({
      email: user.email,
      name: userName,
      temporaryPassword: createUserDto.password,
    });

    const { password, ...result } = user;
    return result;
  }

  async findAll(query: UserSearchQuery): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy,
      sortOrder = "desc",
      role,
      active,
      q,
    } = query;
    // Convert to numbers to avoid Prisma error
    const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    // Build search conditions
    const searchConditions = [];

    // Handle general search (q parameter or search parameter)
    const searchTerm = q || search;
    if (searchTerm) {
      searchConditions.push({
        OR: [
          { email: { contains: searchTerm, mode: "insensitive" } },
          {
            profile: {
              first_name: { contains: searchTerm, mode: "insensitive" },
            },
          },
          {
            profile: {
              last_name: { contains: searchTerm, mode: "insensitive" },
            },
          },
          { role: { name: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }

    // Handle role filter
    if (role) {
      searchConditions.push({ role_name: role });
    }

    // Handle active status filter
    if (active !== undefined) {
      searchConditions.push({ is_active: active === "true" });
    }

    const where = {
      is_deleted: false,
      ...(searchConditions.length > 0 && { AND: searchConditions }),
    };

    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : { created_at: sortOrder };

    const [users, total] = await Promise.all([
      this.prisma.tbm_user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          profile: true,
        },
      }),
      this.prisma.tbm_user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: users,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.tbm_user.findUnique({
      where: { id, is_deleted: false },
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
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    // Prevent modification of superadmin users by non-superadmin users
    if (user.role_name === "superadmin") {
      throw new ForbiddenException("Superadmin users cannot be modified");
    }

    // Check existing code
    const isCodeUnique = await this.checkExistingCode(
      updateUserDto.code,
      user.code
    );
    if (!isCodeUnique) {
      throw new ConflictException("Code already exists");
    }

    // Validate role if provided
    if (updateUserDto.role_name) {
      const role = await this.prisma.tbm_role.findUnique({
        where: { name: updateUserDto.role_name },
      });
      if (!role) {
        throw new BadRequestException("Invalid role specified");
      }

      // Prevent elevation to superadmin
      if (updateUserDto.role_name === "superadmin") {
        throw new BadRequestException("Cannot elevate user to superadmin role");
      }
    }

    // Hash password if provided
    let hashedPassword;
    if (updateUserDto.password) {
      hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.prisma.tbm_user.update({
      where: { id },
      data: {
        ...(updateUserDto.code && { code: updateUserDto.code }),
        ...(updateUserDto.email && { email: updateUserDto.email }),
        ...(hashedPassword && { password: hashedPassword }),
        ...(updateUserDto.role_name !== undefined && {
          role_name: updateUserDto.role_name,
        }),
        ...(updateUserDto.is_active !== undefined && {
          is_active: updateUserDto.is_active,
        }),
        ...(updateUserDto.profile && {
          profile: {
            upsert: {
              create: updateUserDto.profile,
              update: updateUserDto.profile,
            },
          },
        }),
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

    const { password, ...result } = updatedUser;
    return result;
  }

  async remove(id: string) {
    const user = await this.findOne(id);

    // Prevent deletion of superadmin users
    if (user.role_name === "superadmin") {
      throw new ForbiddenException("Superadmin users cannot be deleted");
    }

    // Soft delete
    await this.prisma.tbm_user.update({
      where: { id },
      data: {
        is_deleted: true,
        is_active: false,
      },
    });

    return { message: "User deleted successfully" };
  }

  async anonymize(id: string) {
    const user = await this.findOne(id);

    // Prevent anonymization of superadmin users
    if (user.role_name === "superadmin") {
      throw new ForbiddenException("Superadmin users cannot be anonymized");
    }

    await this.prisma.tbm_user.update({
      where: { id },
      data: {
        email: `anonymized_${id}@deleted.local`,
        is_deleted: true,
        is_active: false,
        profile: {
          update: {
            first_name: "Anonymized",
            last_name: "User",
            phone: null,
            address: null,
            city: null,
            country: null,
            postal_code: null,
            preferences: null,
          },
        },
      },
    });

    return { message: "User anonymized successfully" };
  }

  async activate(id: string) {
    const user = await this.findOne(id);

    await this.prisma.tbm_user.update({
      where: { id },
      data: { is_active: true },
    });

    return { message: "User activated successfully" };
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);

    // Prevent deactivation of superadmin users
    if (user.role_name === "superadmin") {
      throw new ForbiddenException("Superadmin users cannot be deactivated");
    }

    await this.prisma.tbm_user.update({
      where: { id },
      data: { is_active: false },
    });

    return { message: "User deactivated successfully" };
  }

  async getLoginHistory(userId: string, limit = 50) {
    await this.findOne(userId);

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

  async unlock(id: string) {
    await this.findOne(id);

    await this.prisma.tbm_user.update({
      where: { id },
      data: {
        login_attempts: 0,
        locked_until: null,
      },
    });

    return { message: "User unlocked successfully" };
  }

  async updatePreferences(userId: string, preferences: any) {
    await this.findOne(userId);

    const user = await this.prisma.tbm_user.update({
      where: { id: userId },
      data: {
        profile: {
          upsert: {
            create: { preferences },
            update: { preferences },
          },
        },
      },
      include: {
        profile: true,
      },
    });

    return user.profile;
  }

  async getAvailableRoles(allowedRoles: string[]) {
    return this.prisma.tbm_role.findMany({
      where: {
        name: {
          in: allowedRoles,
        },
      },
      select: {
        id: true,
        name: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });
  }
}
