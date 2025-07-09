import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";
import { Role } from "@/constants/role";

interface TenantSearchQuery extends PaginationDto {
  country?: string;
  has_leader?: string;
  q?: string;
}

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateTenantDto) {
    // Check if tenant code already exists
    const existingTenant = await this.prisma.tbm_tenant.findUnique({
      where: { code: createDto.code },
    });

    if (existingTenant) {
      throw new ConflictException("Tenant with this code already exists");
    }

    // Validate leader exists if provided
    if (createDto.leader_id) {
      const leader = await this.prisma.tbm_user.findUnique({
        where: {
          id: createDto.leader_id,
          is_active: true,
          is_deleted: false,
        },
        include: {
          role: true,
        },
      });

      if (!leader) {
        throw new BadRequestException("Leader not found or inactive");
      }

      // Check if leader has appropriate role (admin or standard user)
      if (
        !leader.role ||
        ![Role.Admin, Role.StandardUser].includes(leader.role.name)
      ) {
        throw new BadRequestException(
          "Leader must have admin or standard user role"
        );
      }

      // Check if leader is already leading another tenant
      const existingLeadership = await this.prisma.tbm_tenant.findFirst({
        where: { leader_id: createDto.leader_id },
      });

      if (existingLeadership) {
        throw new ConflictException("User is already leading another tenant");
      }
    }

    const tenant = await this.prisma.tbm_tenant.create({
      data: createDto,
      include: {
        leader: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        employees: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
          take: 10, // Limit to first 10 employees
        },
        _count: {
          select: {
            employees: true,
            projects: true,
            documents: true,
          },
        },
      },
    });

    return tenant;
  }

  async findAll(query: TenantSearchQuery): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy,
      sortOrder = "desc",
      country,
      has_leader,
      q,
    } = query;
    // Convert to numbers to avoid Prisma error
    const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    // Build search conditions
    const searchConditions = [];

    // Handle general search
    const searchTerm = q || search;
    if (searchTerm) {
      searchConditions.push({
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" } },
          { name: { contains: searchTerm, mode: "insensitive" } },
          { country: { contains: searchTerm, mode: "insensitive" } },
          { address: { contains: searchTerm, mode: "insensitive" } },
          { leader: { email: { contains: searchTerm, mode: "insensitive" } } },
          {
            leader: {
              profile: {
                first_name: { contains: searchTerm, mode: "insensitive" },
              },
            },
          },
          {
            leader: {
              profile: {
                last_name: { contains: searchTerm, mode: "insensitive" },
              },
            },
          },
        ],
      });
    }

    // Handle country filter
    if (country) {
      searchConditions.push({ country });
    }

    // Handle has_leader filter
    if (has_leader !== undefined) {
      if (has_leader === "true") {
        searchConditions.push({ leader_id: { not: null } });
      } else if (has_leader === "false") {
        searchConditions.push({ leader_id: null });
      }
    }

    const where = searchConditions.length > 0 ? { AND: searchConditions } : {};
    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : { created_at: sortOrder };

    const [tenants, total] = await Promise.all([
      this.prisma.tbm_tenant.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          leader: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          employees: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
            },
            take: 5, // Limit to first 5 employees in list view
          },
          _count: {
            select: {
              employees: true,
              projects: true,
              documents: true,
            },
          },
        },
      }),
      this.prisma.tbm_tenant.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: tenants,
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
    const tenant = await this.prisma.tbm_tenant.findUnique({
      where: { id },
      include: {
        leader: {
          select: {
            id: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
            profile: {
              select: {
                first_name: true,
                last_name: true,
                phone: true,
                country: true,
                city: true,
              },
            },
          },
        },
        employees: {
          select: {
            id: true,
            email: true,
            is_active: true,
            role: {
              select: {
                name: true,
              },
            },
            profile: {
              select: {
                first_name: true,
                last_name: true,
                phone: true,
              },
            },
            last_login: true,
          },
          orderBy: {
            profile: {
              first_name: "asc",
            },
          },
        },
        projects: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            score: true,
            created_at: true,
            owner: {
              select: {
                email: true,
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
          orderBy: { created_at: "desc" },
          take: 10, // Latest 10 projects
        },
        documents: {
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
          take: 10, // Latest 10 documents
        },
        _count: {
          select: {
            employees: true,
            projects: true,
            documents: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async update(id: string, updateDto: UpdateTenantDto) {
    const tenant = await this.findOne(id);

    // Check if new code conflicts with existing tenants (excluding current one)
    if (updateDto.code && updateDto.code !== tenant.code) {
      const existingTenant = await this.prisma.tbm_tenant.findUnique({
        where: { code: updateDto.code },
      });
      if (existingTenant) {
        throw new ConflictException("Tenant with this code already exists");
      }
    }

    // Validate leader exists if provided
    if (updateDto.leader_id) {
      const leader = await this.prisma.tbm_user.findUnique({
        where: {
          id: updateDto.leader_id,
          is_active: true,
          is_deleted: false,
        },
        include: {
          role: true,
        },
      });

      if (!leader) {
        throw new BadRequestException("Leader not found or inactive");
      }

      // Check if leader has appropriate role (admin or standard user)
      if (
        !leader.role ||
        ![Role.Admin, Role.StandardUser].includes(leader.role.name)
      ) {
        throw new BadRequestException(
          "Leader must have admin or standard user role"
        );
      }

      // Check if leader is already leading another tenant (excluding current tenant)
      const existingLeadership = await this.prisma.tbm_tenant.findFirst({
        where: {
          leader_id: updateDto.leader_id,
          id: { not: id },
        },
      });

      if (existingLeadership) {
        throw new ConflictException("User is already leading another tenant");
      }
    }

    const updatedTenant = await this.prisma.tbm_tenant.update({
      where: { id },
      data: updateDto,
      include: {
        leader: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        employees: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
          take: 10,
        },
        _count: {
          select: {
            employees: true,
            projects: true,
            documents: true,
          },
        },
      },
    });

    return updatedTenant;
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);

    // Check if tenant has employees
    if (tenant._count.employees > 0) {
      throw new BadRequestException(
        "Cannot delete tenant that has employees. Please reassign or remove employees first."
      );
    }

    // Check if tenant has projects
    if (tenant._count.projects > 0) {
      throw new BadRequestException(
        "Cannot delete tenant that has projects. Please reassign or delete projects first."
      );
    }

    // Check if tenant has documents
    if (tenant._count.documents > 0) {
      throw new BadRequestException(
        "Cannot delete tenant that has documents. Please reassign or delete documents first."
      );
    }

    await this.prisma.tbm_tenant.delete({
      where: { id },
    });

    return { message: "Tenant deleted successfully" };
  }

  async addEmployee(tenantId: string, userId: string) {
    const tenant = await this.findOne(tenantId);

    // Check if user exists and is active
    const user = await this.prisma.tbm_user.findUnique({
      where: {
        id: userId,
        is_active: true,
        is_deleted: false,
      },
    });

    if (!user) {
      throw new BadRequestException("User not found or inactive");
    }

    // Check if user is already assigned to another tenant
    if (user.tenant_id && user.tenant_id !== tenantId) {
      throw new ConflictException("User is already assigned to another tenant");
    }

    // Assign user to tenant
    await this.prisma.tbm_user.update({
      where: { id: userId },
      data: { tenant_id: tenantId },
    });

    return { message: "Employee added to tenant successfully" };
  }

  async removeEmployee(tenantId: string, userId: string) {
    const tenant = await this.findOne(tenantId);

    // Check if user exists and is assigned to this tenant
    const user = await this.prisma.tbm_user.findUnique({
      where: { id: userId },
    });

    if (!user || user.tenant_id !== tenantId) {
      throw new BadRequestException(
        "User not found or not assigned to this tenant"
      );
    }

    // Check if user is the tenant leader
    if (tenant.leader_id === userId) {
      throw new BadRequestException(
        "Cannot remove tenant leader. Please assign a new leader first."
      );
    }

    // Remove user from tenant
    await this.prisma.tbm_user.update({
      where: { id: userId },
      data: { tenant_id: null },
    });

    return { message: "Employee removed from tenant successfully" };
  }

  async getEmployees(
    tenantId: string,
    query: PaginationDto
  ): Promise<PaginatedResult<any>> {
    await this.findOne(tenantId);

    const {
      page = 1,
      limit = 10,
      search,
      sortBy,
      sortOrder = "asc",
      q,
    } = query;
    // Convert to numbers to avoid Prisma error
    const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    // Build search conditions
    const searchConditions = [];

    searchConditions.push({ tenant_id: tenantId });

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

    const where =
      searchConditions.length > 1
        ? { AND: searchConditions }
        : searchConditions[0];
    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : {
          profile: { first_name: sortOrder },
        };

    const [employees, total] = await Promise.all([
      this.prisma.tbm_user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        select: {
          id: true,
          email: true,
          is_active: true,
          last_login: true,
          role: {
            select: {
              name: true,
            },
          },
          profile: {
            select: {
              first_name: true,
              last_name: true,
              phone: true,
              country: true,
              city: true,
            },
          },
          created_at: true,
        },
      }),
      this.prisma.tbm_user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: employees,
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

  async getStatistics() {
    const [total, withLeader, withEmployees, withProjects, byCountry] =
      await Promise.all([
        this.prisma.tbm_tenant.count(),
        this.prisma.tbm_tenant.count({
          where: { leader_id: { not: null } },
        }),
        this.prisma.tbm_tenant.count({
          where: {
            employees: {
              some: {},
            },
          },
        }),
        this.prisma.tbm_tenant.count({
          where: {
            projects: {
              some: {},
            },
          },
        }),
        this.prisma.tbm_tenant.groupBy({
          by: ["country"],
          _count: true,
          where: {
            country: { not: null },
          },
          orderBy: {
            _count: {
              country: "desc",
            },
          },
          take: 10,
        }),
      ]);

    return {
      total,
      with_leader: withLeader,
      with_employees: withEmployees,
      with_projects: withProjects,
      without_leader: total - withLeader,
      by_country: byCountry,
    };
  }

  async getAvailableLeaders() {
    // Get users who can be leaders (admin or standard user) and are not already leading a tenant
    return this.prisma.tbm_user.findMany({
      where: {
        is_active: true,
        is_deleted: false,
        role: {
          name: {
            in: [Role.Admin, Role.StandardUser],
          },
        },
        leader_tenants: {
          none: {},
        },
      },
      select: {
        id: true,
        email: true,
        role: {
          select: {
            name: true,
          },
        },
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        profile: {
          first_name: "asc",
        },
      },
    });
  }
}
