import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { BaseService } from "../../common/services/base.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { CreateProjectStatusDto } from "./dto/create-project-status.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";
import { EmailService } from "@/email/email.service";
import { Project } from "@/constants/project";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  buildProjectInclude,
  PROJECT_DETAIL_INCLUDE,
} from "./project.includes";
import { CurrentUser } from "../../types/user.types";

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
export class ProjectService extends BaseService {
  constructor(
    prisma: PrismaService,
    private emailService: EmailService
  ) {
    super(prisma);
  }

  async create(createDto: CreateProjectDto, user: CurrentUser) {
    this.logOperation("Creating project", undefined, user.id);

    return this.executeTransaction(async (tx) => {
      // Validate project code uniqueness
      const existingProject = await tx.tbm_project.findUnique({
        where: { code: createDto.code },
      });

      if (existingProject) {
        throw new ConflictException("Project with this code already exists");
      }

      // Validate related entities in parallel
      const validationPromises = [];

      if (createDto.owner_id) {
        validationPromises.push(
          tx.tbm_user
            .findUnique({
              where: {
                id: createDto.owner_id,
                is_active: true,
                is_deleted: false,
              },
            })
            .then((owner) => {
              if (!owner) {
                throw new BadRequestException("Owner not found or inactive");
              }
              return owner;
            })
        );
      }

      if (createDto.tenant_id) {
        validationPromises.push(
          tx.tbm_tenant
            .findUnique({
              where: { id: createDto.tenant_id },
            })
            .then((tenant) => {
              if (!tenant) {
                throw new BadRequestException("Tenant not found");
              }
              return tenant;
            })
        );
      }

      if (createDto.indicators?.length) {
        const indicatorIds = createDto.indicators.map((i) => i.indicator_id);
        validationPromises.push(
          tx.tbm_performance_indicator
            .findMany({
              where: { id: { in: indicatorIds } },
            })
            .then((indicators) => {
              if (indicators.length !== indicatorIds.length) {
                throw new BadRequestException(
                  "One or more performance indicators not found"
                );
              }
              return indicators;
            })
        );
      }

      await Promise.all(validationPromises);

      // Create the project
      const project = await tx.tbm_project.create({
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
          domains: this.validateArrayField(createDto.domains, "domains"),
          pillars: this.validateArrayField(createDto.pillars, "pillars"),
          tenant_id: createDto.tenant_id || null,
          owner_id: createDto.owner_id || user.id,
        },
      });

      // Create related data in parallel
      const operations = [];

      // Create project indicators
      if (createDto.indicators?.length) {
        operations.push(
          tx.tbs_project_performance_indicator.createMany({
            data: createDto.indicators.map((indicator) => ({
              project_id: project.id,
              indicator_id: indicator.indicator_id,

              expected_trend: indicator.expected_trend,
              expected_score: indicator.expected_score,
              score: indicator.score,
            })),
          })
        );
      }

      // Create initial status
      operations.push(
        tx.tbs_project_status.create({
          data: {
            project_id: project.id,
            status: createDto.status || Project.Status.Framing,
            description: "Project created",
          },
        })
      );

      // Create documents
      if (createDto.files?.length) {
        operations.push(
          tx.tbm_document.createMany({
            data: createDto.files.map((url) => ({
              name: url.split("/").pop() || "Untitled Document",
              content: url,
              tenant_id: createDto.tenant_id || null,
              project_id: project.id,
            })),
          })
        );
      }

      if (createDto.images?.length) {
        operations.push(
          tx.tbs_project_image.createMany({
            data: createDto.images.map((url) => ({
              project_id: project.id,
              creator_id: user.id,

              name: url.split("/").pop() || "Untitled Image",
              image_url: url,
              description: `Image uploaded on project creation`,
            })),
          })
        );
      }

      await Promise.all(operations);

      await tx.tbs_project_timeline.create({
        data: {
          project_id: project.id,
          creator_id: user.id,

          event: "Project created",
          description: "Initial project creation",
        },
      });

      // Return the complete project
      return await tx.tbm_project.findUnique({
        where: { id: project.id },
        include: PROJECT_DETAIL_INCLUDE,
      });
    });
  }

  async findAll(
    query: ProjectSearchQuery,
    user: CurrentUser
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "created_at",
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

    this.logOperation("Finding all projects", undefined, user.id);

    // Convert to numbers and build pagination
    const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const pagination = this.buildPaginationOptions({
      page: pageNum,
      limit: limitNum,
    });

    // Build search conditions
    const searchConditions = [];

    // General search
    const searchTerm = q || search;
    if (searchTerm) {
      const searchFields = [
        "code",
        "name",
        "description",
        "country",
        "owner.email",
        "tenant.name",
      ];
      searchConditions.push(
        this.buildSearchConditions(searchTerm, searchFields)
      );
    }

    // Specific filters
    if (status) searchConditions.push({ status });
    if (owner_id) searchConditions.push({ owner_id });
    if (tenant_id) searchConditions.push({ tenant_id });

    // Country filter
    if (country) {
      const countries = this.validateArrayField(country, "countries");
      searchConditions.push({ country: { in: countries } });
    }

    // Domain and pillar filters
    if (domains) {
      const domainList = this.validateArrayField(domains, "domains");
      searchConditions.push({ domains: { hasSome: domainList } });
    }

    if (pillars) {
      const pillarList = this.validateArrayField(pillars, "pillars");
      searchConditions.push({ pillars: { hasSome: pillarList } });
    }

    // Date range filters
    if (start_date) {
      searchConditions.push({ start_date: { gte: new Date(start_date) } });
    }
    if (end_date) {
      searchConditions.push({ end_date: { lte: new Date(end_date) } });
    }

    // Score filter
    if (score !== undefined) {
      const scoreValue = this.validateNumericInput(score, "score", 0, 100);
      searchConditions.push({ score: { gte: scoreValue } });
    }

    // Access control
    const accessConditions = this.buildAccessControlConditions({
      userId: user.id,
      userRole: user.role?.name,
      checkOwnership: true,
      checkTenantAccess: true,
    });
    searchConditions.push(...accessConditions);

    const where = searchConditions.length > 0 ? { AND: searchConditions } : {};
    const orderBy = this.buildSortOptions({ sortBy, sortOrder });
    const include = buildProjectInclude({
      owner: true,
      tenant: true,
      indicators: true,
      _count: true,
    });

    // Execute query with count in parallel
    const [projects, total] = await Promise.all([
      this.prisma.tbm_project.findMany({
        where,
        ...pagination,
        orderBy,
        include,
      }),
      this.prisma.tbm_project.count({ where }),
    ]);

    return {
      data: projects,
      meta: this.calculatePaginationMeta(total, pageNum, limitNum),
    };
  }

  async findOne(id: string, user: CurrentUser) {
    this.logOperation("Finding project", id, user.id);

    const project = await this.prisma.tbm_project.findUnique({
      where: { id },
      include: PROJECT_DETAIL_INCLUDE,
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    // Check access
    const hasAccess = await this.checkEntityAccess(project, {
      userId: user.id,
      userRole: user.role?.name,
      checkOwnership: true,
      checkTenantAccess: true,
    });

    if (!hasAccess) {
      throw new ForbiddenException("Access denied to this project");
    }

    return project;
  }

  async update(id: string, updateDto: UpdateProjectDto, user: CurrentUser) {
    this.logOperation("Updating project", id, user.id);

    return this.executeTransaction(async (tx) => {
      // Verify project exists and check access
      const existingProject = await tx.tbm_project.findUnique({
        where: { id },
        include: { tenant: true, owner: true },
      });

      if (!existingProject) {
        throw new NotFoundException("Project not found");
      }

      const hasAccess = await this.checkEntityAccess(existingProject, {
        userId: user.id,
        userRole: user.role?.name,
        checkOwnership: true,
        checkTenantAccess: true,
      });

      if (!hasAccess) {
        throw new ForbiddenException("Access denied to this project");
      }

      // Validate code uniqueness if changed
      if (updateDto.code && updateDto.code !== existingProject.code) {
        const conflictingProject = await tx.tbm_project.findUnique({
          where: { code: updateDto.code },
        });
        if (conflictingProject) {
          throw new ConflictException("Project with this code already exists");
        }
      }

      // Validate related entities in parallel
      const validationPromises = [];

      if (updateDto.owner_id) {
        validationPromises.push(
          tx.tbm_user
            .findUnique({
              where: {
                id: updateDto.owner_id,
                is_active: true,
                is_deleted: false,
              },
            })
            .then((owner) => {
              if (!owner) {
                throw new BadRequestException("Owner not found or inactive");
              }
            })
        );
      }

      if (updateDto.tenant_id) {
        validationPromises.push(
          tx.tbm_tenant
            .findUnique({
              where: { id: updateDto.tenant_id },
            })
            .then((tenant) => {
              if (!tenant) {
                throw new BadRequestException("Tenant not found");
              }
            })
        );
      }

      await Promise.all(validationPromises);

      // Build update data
      const updateData: any = {};

      // Simple field updates
      if (updateDto.code !== undefined) updateData.code = updateDto.code;
      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.description !== undefined)
        updateData.description = updateDto.description;
      if (updateDto.country !== undefined)
        updateData.country = updateDto.country;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;
      if (updateDto.score !== undefined) updateData.score = updateDto.score;
      if (updateDto.domains !== undefined)
        updateData.domains = this.validateArrayField(
          updateDto.domains,
          "domains"
        );
      if (updateDto.pillars !== undefined)
        updateData.pillars = this.validateArrayField(
          updateDto.pillars,
          "pillars"
        );
      if (updateDto.start_date !== undefined)
        updateData.start_date = updateDto.start_date
          ? new Date(updateDto.start_date)
          : null;
      if (updateDto.end_date !== undefined)
        updateData.end_date = updateDto.end_date
          ? new Date(updateDto.end_date)
          : null;
      if (updateDto.tenant_id !== undefined)
        updateData.tenant_id = updateDto.tenant_id;
      if (updateDto.owner_id !== undefined)
        updateData.owner_id = updateDto.owner_id;

      // Update project
      await tx.tbm_project.update({
        where: { id },
        data: updateData,
      });

      // Handle indicators update
      if (updateDto.indicators) {
        const indicatorIds = updateDto.indicators.map((i) => i.indicator_id);

        // Validate indicators exist
        const indicators = await tx.tbm_performance_indicator.findMany({
          where: { id: { in: indicatorIds } },
        });

        if (indicators.length !== indicatorIds.length) {
          throw new BadRequestException(
            "One or more performance indicators not found"
          );
        }

        // Delete existing and create new indicators
        await tx.tbs_project_performance_indicator.deleteMany({
          where: { project_id: id },
        });

        if (indicatorIds.length > 0) {
          await tx.tbs_project_performance_indicator.createMany({
            data: updateDto.indicators.map((indicator) => ({
              project_id: id,
              indicator_id: indicator.indicator_id,

              expected_trend: indicator.expected_trend,
              expected_score: indicator.expected_score,
              score: indicator.score,
            })),
          });
        }
      }

      // Create status entry if status changed
      if (updateDto.status && updateDto.status !== existingProject.status) {
        await tx.tbs_project_status.create({
          data: {
            project_id: id,
            status: updateDto.status,
            description: `Status changed to ${updateDto.status}`,
          },
        });
      }

      if (updateDto.files && updateDto.files.length > 0) {
        await tx.tbm_document.deleteMany({
          where: { project_id: id },
        });

        await tx.tbm_document.createMany({
          data: updateDto.files.map((url) => ({
            name: url.split("/").pop() || "Untitled Document",
            content: url,
            tenant_id: existingProject.tenant_id || null,
            project_id: id,
          })),
        });
      }

      if (updateDto.images && updateDto.images.length > 0) {
        await tx.tbs_project_image.deleteMany({
          where: { project_id: id },
        });

        await tx.tbs_project_image.createMany({
          data: updateDto.images.map((url) => ({
            project_id: id,
            creator_id: user.id,

            name: url.split("/").pop() || "Untitled Image",
            image_url: url,
            description: `Image updated on project update`,
          })),
        });
      }

      // Create timeline entry for update
      await tx.tbs_project_timeline.create({
        data: {
          project_id: id,
          creator_id: user.id,
          event: "Project updated",
          description: `Project updated by ${user.profile?.first_name || user.email}`,
        },
      });

      // Return updated project with all relations
      return await tx.tbm_project.findUnique({
        where: { id },
        include: PROJECT_DETAIL_INCLUDE,
      });
    });
  }

  async remove(id: string, user: CurrentUser) {
    this.logOperation("Removing project", id, user.id);

    return this.executeTransaction(async (tx) => {
      const project = await tx.tbm_project.findUnique({
        where: { id },
        include: { owner: true, tenant: true },
      });

      if (!project) {
        throw new NotFoundException("Project not found");
      }

      const hasAccess = await this.checkEntityAccess(project, {
        userId: user.id,
        userRole: user.role?.name,
        checkOwnership: true,
        checkTenantAccess: true,
      });

      if (!hasAccess) {
        throw new ForbiddenException("Access denied to this project");
      }

      // Only allow deletion by project owner or admin/superadmin
      if (user.role?.name === "user" && project.owner_id !== user.id) {
        throw new ForbiddenException(
          "Only project owner can delete the project"
        );
      }

      await tx.tbm_project.delete({ where: { id } });
      return { message: "Project deleted successfully" };
    });
  }

  async addStatus(
    projectId: string,
    createStatusDto: CreateProjectStatusDto,
    user: CurrentUser
  ) {
    this.logOperation("Adding project status", projectId, user.id);

    return this.executeTransaction(async (tx) => {
      const project = await tx.tbm_project.findUnique({
        where: { id: projectId },
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
              name: true,
            },
          },
        },
      });

      if (!project) {
        throw new NotFoundException("Project not found");
      }

      const hasAccess = await this.checkEntityAccess(project, {
        userId: user.id,
        userRole: user.role?.name,
        checkOwnership: true,
        checkTenantAccess: true,
      });

      if (!hasAccess) {
        throw new ForbiddenException("Access denied to this project");
      }

      // Create status
      const status = await tx.tbs_project_status.create({
        data: {
          project_id: projectId,
          status: createStatusDto.status,
          description: createStatusDto.description,
        },
      });

      // Update project's current status
      await tx.tbm_project.update({
        where: { id: projectId },
        data: { status: createStatusDto.status },
      });

      // Send status update email to project owner if different from current user
      if (project.owner && project.owner.id !== user.id) {
        const ownerName = project.owner.profile?.first_name
          ? `${project.owner.profile.first_name} ${project.owner.profile.last_name || ""}`.trim()
          : project.owner.email;

        // Send email asynchronously to not block the transaction
        setImmediate(async () => {
          try {
            await this.emailService.sendProjectStatusUpdateEmail({
              email: project.owner.email,
              name: ownerName,
              projectName: project.name,
              oldStatus: project.status,
              newStatus: createStatusDto.status,
              description: createStatusDto.description,
            });
          } catch (error) {
            this.logger.error("Failed to send status update email", error);
          }
        });
      }

      // Create timeline entry for status change
      await tx.tbs_project_timeline.create({
        data: {
          project_id: projectId,
          creator_id: user.id,
          event: "Project status updated",
          description: `Status changed to ${createStatusDto.status} by ${user.profile?.first_name || user.email}`,
        },
      });

      return status;
    });
  }

  async getStatuses(projectId: string, user: CurrentUser) {
    this.logOperation("Getting project statuses", projectId, user.id);

    // Verify access to project first
    await this.findOne(projectId, user);

    return this.prisma.tbs_project_status.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
    });
  }

  async updateIndicatorScore(
    projectId: string,
    indicatorId: string,
    score: number,
    user: CurrentUser
  ) {
    this.logOperation("Updating indicator score", projectId, user.id);

    return this.executeTransaction(async (tx) => {
      // Verify project access
      const project = await tx.tbm_project.findUnique({
        where: { id: projectId },
        include: { owner: true, tenant: true },
      });

      if (!project) {
        throw new NotFoundException("Project not found");
      }

      const hasAccess = await this.checkEntityAccess(project, {
        userId: user.id,
        userRole: user.role?.name,
        checkOwnership: true,
        checkTenantAccess: true,
      });

      if (!hasAccess) {
        throw new ForbiddenException("Access denied to this project");
      }

      // Validate and update indicator score
      const validatedScore = this.validateNumericInput(score, "score", 0, 100);

      const projectIndicator =
        await tx.tbs_project_performance_indicator.findUnique({
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
        await tx.tbs_project_performance_indicator.update({
          where: {
            project_id_indicator_id: {
              project_id: projectId,
              indicator_id: indicatorId,
            },
          },
          data: { score: validatedScore },
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
      await this.recalculateProjectScore(tx, projectId);

      return updatedIndicator;
    });
  }

  async getProjectStatistics(user: CurrentUser) {
    this.logOperation("Getting project statistics", undefined, user.id);

    const accessConditions = this.buildAccessControlConditions({
      userId: user.id,
      userRole: user.role?.name,
      checkOwnership: true,
      checkTenantAccess: true,
    });

    const where = accessConditions.length > 0 ? { AND: accessConditions } : {};

    const [total, byStatus, byOwner, recentProjects] = await Promise.all([
      this.prisma.tbm_project.count({ where }),
      this.prisma.tbm_project.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      this.prisma.tbm_project.groupBy({
        by: ["owner_id"],
        where,
        _count: true,
      }),
      this.prisma.tbm_project.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: 5,
        include: buildProjectInclude({ owner: true }),
      }),
    ]);
    return {
      total,
      by_status: byStatus,
      by_owner: byOwner,
      recent_projects: recentProjects,
    };
  }

  /**
   * Private helper methods
   */

  private async recalculateProjectScore(tx: any, projectId: string) {
    const indicators = await tx.tbs_project_performance_indicator.findMany({
      where: { project_id: projectId },
      select: { score: true },
    });

    if (indicators.length > 0) {
      const validScores = indicators
        .filter((i) => i.score !== null)
        .map((i) => Number(i.score));

      if (validScores.length > 0) {
        const averageScore =
          validScores.reduce((sum, score) => sum + score, 0) /
          validScores.length;

        await tx.tbm_project.update({
          where: { id: projectId },
          data: { score: Math.round(averageScore * 100) / 100 },
        });
      }
    }
  }
}
