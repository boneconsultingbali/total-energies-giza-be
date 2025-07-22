import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { CreateProjectStatusDto } from "./dto/create-project-status.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";
import { EmailService } from "@/email/email.service";
import { Project } from "@/constants/project";

interface ProjectSearchQuery extends PaginationDto {
  // Direct project fields from schema
  status?: string;
  country?: string; // Direct field on project
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  score?: number;

  // Relationship fields
  owner_id?: string;
  tenant_id?: string;

  // Array fields (support multiple values)
  domains?: string; // Multiple values separated by commas
  pillars?: string; // Multiple values separated by commas

  // General search
  q?: string;
}

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  async create(createDto: CreateProjectDto, userId: string) {
    // Check if project code already exists
    const existingProject = await this.prisma.tbm_project.findUnique({
      where: { code: createDto.code },
    });

    if (existingProject) {
      throw new ConflictException("Project with this code already exists");
    }

    // Validate owner exists if provided
    if (createDto.owner_id) {
      const owner = await this.prisma.tbm_user.findUnique({
        where: { id: createDto.owner_id, is_active: true, is_deleted: false },
      });
      if (!owner) {
        throw new BadRequestException("Owner not found or inactive");
      }
    }

    // Validate tenant exists if provided
    if (createDto.tenant_id) {
      const tenant = await this.prisma.tbm_tenant.findUnique({
        where: { id: createDto.tenant_id },
      });
      if (!tenant) {
        throw new BadRequestException("Tenant not found");
      }
    }

    // Validate indicators exist if provided
    if (createDto.indicators && createDto.indicators.length > 0) {
      const indicatorIds = createDto.indicators.map((i) => i.indicator_id);
      const indicators = await this.prisma.tbm_performance_indicator.findMany({
        where: { id: { in: indicatorIds } },
      });

      if (indicators.length !== indicatorIds.length) {
        throw new BadRequestException(
          "One or more performance indicators not found"
        );
      }
    }

    // Create project with indicators
    const project = await this.prisma.tbm_project.create({
      data: {
        code: createDto.code,
        name: createDto.name,
        description: createDto.description,
        country: createDto.country,
        start_date: createDto.start_date
          ? new Date(createDto.start_date)
          : null,
        end_date: createDto.end_date ? new Date(createDto.end_date) : null,
        status: createDto.status || Project.Status.Framing,
        score: createDto.score,

        domains: createDto.domains || [],
        pillars: createDto.pillars || [],
        indicators: createDto.indicators
          ? {
              create: createDto.indicators.map((indicator) => ({
                indicator_id: indicator.indicator_id,
                score: indicator.score,
              })),
            }
          : undefined,

        tenant_id: createDto.tenant_id || null,
        owner_id: createDto.owner_id || userId,
        statuses: {
          create: {
            status: createDto.status || Project.Status.Framing,
            description: "Project created",
          },
        },
      },
      include: {
        owner: {
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
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        indicators: {
          include: {
            indicator: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        statuses: {
          orderBy: { created_at: "desc" },
          take: 5,
        },
        documents: {
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
          },
        },
        _count: {
          select: {
            indicators: true,
            documents: true,
            statuses: true,
          },
        },
      },
    });

    return project;
  }

  async findAll(
    query: ProjectSearchQuery,
    userId: string,
    userRole: string
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy,
      sortOrder = "desc",
      status,
      country,
      start_date,
      end_date,
      score,
      owner_id,
      tenant_id,
      domains,
      pillars,
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
          { description: { contains: searchTerm, mode: "insensitive" } },
          { country: { contains: searchTerm, mode: "insensitive" } },
          { owner: { email: { contains: searchTerm, mode: "insensitive" } } },
          { tenant: { name: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }

    // Handle status filter
    if (status) {
      searchConditions.push({ status });
    }

    // Handle country filter (direct field on project)
    if (country) {
      const countries = country.split(",").map((c) => c.trim());
      searchConditions.push({
        country: {
          in: countries,
        },
      });
    }

    // Handle date range filters
    if (start_date) {
      searchConditions.push({
        start_date: {
          gte: new Date(start_date),
        },
      });
    }

    if (end_date) {
      searchConditions.push({
        end_date: {
          lte: new Date(end_date),
        },
      });
    }

    // Handle score filter
    if (score !== undefined) {
      searchConditions.push({
        score: {
          gte: score,
        },
      });
    }

    // Handle owner filter
    if (owner_id) {
      searchConditions.push({ owner_id });
    }

    // Handle tenant filter
    if (tenant_id) {
      searchConditions.push({ tenant_id });
    }

    // Handle domains filter (array field)
    if (domains) {
      const domainList = domains.split(",").map((d) => d.trim());
      searchConditions.push({
        domains: {
          hasSome: domainList,
        },
      });
    }

    // Handle pillars filter (array field)
    if (pillars) {
      const pillarList = pillars.split(",").map((p) => p.trim());
      searchConditions.push({
        pillars: {
          hasSome: pillarList,
        },
      });
    }

    // Role-based access control
    if (userRole === "user") {
      // Users can only see projects they own or are part of their tenant
      searchConditions.push({
        OR: [
          { owner_id: userId },
          { tenant: { employees: { some: { id: userId } } } },
        ],
      });
    }

    const where = searchConditions.length > 0 ? { AND: searchConditions } : {};
    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : { created_at: sortOrder };

    const [projects, total] = await Promise.all([
      this.prisma.tbm_project.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          owner: {
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
          tenant: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          indicators: {
            include: {
              indicator: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
          _count: {
            select: {
              indicators: true,
              documents: true,
              statuses: true,
            },
          },
        },
      }),
      this.prisma.tbm_project.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: projects,
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

  async findOne(id: string, userId: string, userRole: string) {
    const project = await this.prisma.tbm_project.findUnique({
      where: { id },
      include: {
        owner: {
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
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
            country: true,
            address: true,
          },
        },
        indicators: {
          include: {
            indicator: {
              select: {
                id: true,
                name: true,
                description: true,
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
        },
        statuses: {
          orderBy: { created_at: "desc" },
        },
        documents: {
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { created_at: "desc" },
        },
        _count: {
          select: {
            indicators: true,
            documents: true,
            statuses: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    // Role-based access control
    if (userRole === "user") {
      const hasAccess =
        project.owner_id === userId ||
        (project.tenant &&
          (await this.checkUserTenantAccess(userId, project.tenant_id)));

      if (!hasAccess) {
        throw new ForbiddenException("Access denied to this project");
      }
    }

    return project;
  }

  async update(
    id: string,
    updateDto: UpdateProjectDto,
    userId: string,
    userRole: string
  ) {
    const project = await this.findOne(id, userId, userRole);

    // Check if new code conflicts with existing projects (excluding current one)
    if (updateDto.code && updateDto.code !== project.code) {
      const existingProject = await this.prisma.tbm_project.findUnique({
        where: { code: updateDto.code },
      });
      if (existingProject) {
        throw new ConflictException("Project with this code already exists");
      }
    }

    // Validate owner exists if provided
    if (updateDto.owner_id) {
      const owner = await this.prisma.tbm_user.findUnique({
        where: { id: updateDto.owner_id, is_active: true, is_deleted: false },
      });
      if (!owner) {
        throw new BadRequestException("Owner not found or inactive");
      }
    }

    // Validate tenant exists if provided
    if (updateDto.tenant_id) {
      const tenant = await this.prisma.tbm_tenant.findUnique({
        where: { id: updateDto.tenant_id },
      });
      if (!tenant) {
        throw new BadRequestException("Tenant not found");
      }
    }

    // Handle indicators update
    let indicatorOperations = {};
    if (updateDto.indicators) {
      // Validate indicators exist
      const indicatorIds = updateDto.indicators.map((i) => i.indicator_id);
      const indicators = await this.prisma.tbm_performance_indicator.findMany({
        where: { id: { in: indicatorIds } },
      });

      if (indicators.length !== indicatorIds.length) {
        throw new BadRequestException(
          "One or more performance indicators not found"
        );
      }

      // Delete existing indicators and create new ones
      indicatorOperations = {
        deleteMany: {},
        create: updateDto.indicators.map((indicator) => ({
          indicator_id: indicator.indicator_id,
          score: indicator.score,
        })),
      };
    }

    // Create status entry if status is being updated
    let statusOperations = {};
    if (updateDto.status && updateDto.status !== project.status) {
      statusOperations = {
        create: {
          status: updateDto.status,
          description: `Status changed to ${updateDto.status}`,
        },
      };
    }

    // Build update data object dynamically
    const updateData: any = {};

    // Simple field updates
    if (updateDto.code) updateData.code = updateDto.code;
    if (updateDto.name) updateData.name = updateDto.name;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.country) updateData.country = updateDto.country;
    if (updateDto.status) updateData.status = updateDto.status;
    if (updateDto.score !== undefined) updateData.score = updateDto.score;
    if (updateDto.domains) updateData.domains = updateDto.domains;
    if (updateDto.pillars) updateData.pillars = updateDto.pillars;

    // Date field updates (with transformation)
    if (updateDto.start_date)
      updateData.start_date = new Date(updateDto.start_date);
    if (updateDto.end_date) updateData.end_date = new Date(updateDto.end_date);

    // Nullable field updates
    if (updateDto.tenant_id !== undefined)
      updateData.tenant_id = updateDto.tenant_id;
    if (updateDto.owner_id) updateData.owner_id = updateDto.owner_id;

    // Relation updates
    if (updateDto.indicators) updateData.indicators = indicatorOperations;
    if (Object.keys(statusOperations).length > 0)
      updateData.statuses = statusOperations;

    const updatedProject = await this.prisma.tbm_project.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
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
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        indicators: {
          include: {
            indicator: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        statuses: {
          orderBy: { created_at: "desc" },
          take: 5,
        },
        documents: {
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
          },
        },
        _count: {
          select: {
            indicators: true,
            documents: true,
            statuses: true,
          },
        },
      },
    });

    return updatedProject;
  }

  async remove(id: string, userId: string, userRole: string) {
    const project = await this.findOne(id, userId, userRole);

    // Only allow deletion by project owner or admin/superadmin
    if (userRole === "user" && project.owner_id !== userId) {
      throw new ForbiddenException("Only project owner can delete the project");
    }

    await this.prisma.tbm_project.delete({
      where: { id },
    });

    return { message: "Project deleted successfully" };
  }

  async addStatus(
    projectId: string,
    createStatusDto: CreateProjectStatusDto,
    userId: string,
    userRole: string
  ) {
    const project = await this.findOne(projectId, userId, userRole);

    const status = await this.prisma.tbs_project_status.create({
      data: {
        project_id: projectId,
        status: createStatusDto.status,
        description: createStatusDto.description,
      },
    });

    // Update project's current status
    await this.prisma.tbm_project.update({
      where: { id: projectId },
      data: { status: createStatusDto.status },
    });

    // Send status update email to project owner if different from current user
    if (project.owner && project.owner.id !== userId) {
      const ownerName = project.owner.profile?.first_name
        ? `${project.owner.profile.first_name} ${project.owner.profile.last_name || ""}`.trim()
        : project.owner.email;

      await this.emailService.sendProjectStatusUpdateEmail({
        email: project.owner.email,
        name: ownerName,
        projectName: project.name,
        oldStatus: project.status,
        newStatus: createStatusDto.status,
        description: createStatusDto.description,
      });
    }

    return status;
  }

  async getStatuses(projectId: string, userId: string, userRole: string) {
    await this.findOne(projectId, userId, userRole);

    return this.prisma.tbs_project_status.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
    });
  }

  async updateIndicatorScore(
    projectId: string,
    indicatorId: string,
    score: number,
    userId: string,
    userRole: string
  ) {
    await this.findOne(projectId, userId, userRole);

    const projectIndicator =
      await this.prisma.tbs_project_performance_indicator.findUnique({
        where: {
          project_id_indicator_id: {
            project_id: projectId,
            indicator_id: indicatorId,
          },
        },
      });

    if (!projectIndicator) {
      throw new NotFoundException(
        "Performance indicator not found for this project"
      );
    }

    const updatedIndicator =
      await this.prisma.tbs_project_performance_indicator.update({
        where: {
          project_id_indicator_id: {
            project_id: projectId,
            indicator_id: indicatorId,
          },
        },
        data: { score },
        include: {
          indicator: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

    // Recalculate project overall score
    await this.recalculateProjectScore(projectId);

    return updatedIndicator;
  }

  async getProjectStatistics(userId: string, userRole: string) {
    let whereCondition = {};

    // Role-based filtering
    if (userRole === "user") {
      whereCondition = {
        OR: [
          { owner_id: userId },
          { tenant: { employees: { some: { id: userId } } } },
        ],
      };
    }

    const [total, byStatus, byOwner, recentProjects] = await Promise.all([
      this.prisma.tbm_project.count({ where: whereCondition }),
      this.prisma.tbm_project.groupBy({
        by: ["status"],
        where: whereCondition,
        _count: true,
      }),
      this.prisma.tbm_project.groupBy({
        by: ["owner_id"],
        where: whereCondition,
        _count: true,
      }),
      this.prisma.tbm_project.findMany({
        where: whereCondition,
        orderBy: { created_at: "desc" },
        take: 5,
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
      }),
    ]);

    return {
      total,
      by_status: byStatus,
      by_owner: byOwner,
      recent_projects: recentProjects,
    };
  }

  private async checkUserTenantAccess(
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    const user = await this.prisma.tbm_user.findUnique({
      where: { id: userId },
      select: { tenant_id: true },
    });

    return user?.tenant_id === tenantId;
  }

  private async recalculateProjectScore(projectId: string) {
    const indicators =
      await this.prisma.tbs_project_performance_indicator.findMany({
        where: { project_id: projectId },
        select: { score: true },
      });

    if (indicators.length > 0) {
      const validScores = indicators
        .filter((i) => i.score !== null)
        .map((i) => i.score);
      if (validScores.length > 0) {
        const averageScore =
          validScores.reduce((sum, score) => Number(sum) + Number(score), 0) /
          validScores.length;

        await this.prisma.tbm_project.update({
          where: { id: projectId },
          data: { score: Math.round(averageScore * 100) / 100 },
        });
      }
    }
  }
}
