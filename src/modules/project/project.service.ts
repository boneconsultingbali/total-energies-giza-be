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
import { Project, ProjectStatusColors } from "@/constants/project";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  buildProjectInclude,
  PROJECT_DETAIL_INCLUDE,
} from "./project.includes";
import { CurrentUser } from "../../types/user.types";
import { ProjectTimelineResponse } from "./dto/project-timeline-response.dto";

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

      // Build update data using helper method
      const updateData = this.buildProjectUpdateData(updateDto);

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

      // Handle files and images update
      await this.handleFileOperations(
        tx,
        id,
        existingProject.tenant_id || null,
        updateDto
      );
      await this.handleImageOperations(tx, id, user.id, updateDto);

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

  async getProjectPerformancePyramidById(projectId: string, user: CurrentUser) {
    this.logOperation(
      "Getting project performance pyramid",
      projectId,
      user.id
    );

    // Verify access to project first
    await this.findOne(projectId, user);

    // Get project performance indicators with their scores
    const projectIndicators =
      await this.prisma.tbs_project_performance_indicator.findMany({
        where: { project_id: projectId },
        include: {
          indicator: {
            include: {
              parent: true,
              children: true,
            },
          },
        },
      });

    // Get all performance indicators to understand the hierarchy
    const allIndicators = await this.prisma.tbm_performance_indicator.findMany({
      include: {
        parent: true,
        children: true,
      },
    });

    // Group indicators by pillar
    const groupedByPillar = {
      Operating: this.buildPyramidStructure(
        projectIndicators,
        allIndicators,
        "Operating"
      ),
      Environmental: this.buildPyramidStructure(
        projectIndicators,
        allIndicators,
        "Environmental"
      ),
      Safety: this.buildPyramidStructure(
        projectIndicators,
        allIndicators,
        "Safety"
      ),
    };

    return {
      operatingPerformanceData: groupedByPillar.Operating,
      environmentalPerformanceData: groupedByPillar.Environmental,
      safetyPerformanceData: groupedByPillar.Safety,
    };
  }

  async getProjectTimelineById(
    projectId: string,
    user: CurrentUser
  ): Promise<ProjectTimelineResponse> {
    this.logOperation("Getting project timeline", projectId, user.id);

    // Verify access to project first
    const project = await this.findOne(projectId, user);

    // Get all timeline activities for the project
    const timelineActivities =
      await this.getProjectTimelineActivities(projectId);

    // Group activities by project phases/statuses
    const timeline = this.buildTimelineByPhases(
      project,
      timelineActivities,
      ProjectStatusColors
    );

    return timeline;
  }

  private buildPyramidStructure(
    projectIndicators: any[],
    allIndicators: any[],
    pillar: string
  ) {
    // Filter indicators by pillar
    const pillarIndicators = allIndicators.filter(
      (ind) => ind.pillar === pillar
    );

    // Get root level indicators (those without parents)
    const rootIndicators = pillarIndicators.filter((ind) => !ind.parent_id);

    // Build the pyramid structure
    const pyramidData = rootIndicators.map((rootIndicator) => {
      const level = this.calculateLevel(rootIndicator, pillarIndicators);
      const hasChildren =
        rootIndicator.children && rootIndicator.children.length > 0;

      // Find project expected_score for this indicator
      const projectIndicator = projectIndicators.find(
        (pi) => pi.indicator_id === rootIndicator.id
      );
      const score = projectIndicator?.expected_score
        ? parseFloat(projectIndicator.expected_score)
        : null;

      const baseStructure: any = {
        name: rootIndicator.name,
        level: level,
        onprogress: this.determineProgressStatus(score, rootIndicator.is_grey),
        progressItem: this.buildProgressItems(rootIndicator, projectIndicator),
      };

      // If has children, build subchild structure
      if (hasChildren) {
        baseStructure.subchild = rootIndicator.children.map(
          (child, childIndex) => {
            const childProjectIndicator = projectIndicators.find(
              (pi) => pi.indicator_id === child.id
            );
            const childScore = childProjectIndicator?.expected_score
              ? parseFloat(childProjectIndicator.expected_score)
              : null;

            return {
              subLevel: childIndex + 1,
              name: child.name,
              onprogress: this.determineProgressStatus(
                childScore,
                child.is_grey
              ),
              progressItem: this.buildProgressItems(
                child,
                childProjectIndicator
              ),
            };
          }
        );
      }

      return baseStructure;
    });

    // Add additional levels based on hierarchy depth
    const allLevelIndicators = pillarIndicators.filter((ind) => ind.parent_id);
    const additionalLevels = this.buildAdditionalLevels(
      allLevelIndicators,
      projectIndicators,
      rootIndicators
    );

    return [...pyramidData, ...additionalLevels];
  }

  private calculateLevel(indicator: any, allIndicators: any[]): number {
    // Calculate level based on hierarchy depth
    let level = 1;
    const descendants = this.getDescendants(indicator, allIndicators);

    if (descendants.length === 0) {
      // Leaf nodes get higher levels
      level = 4;
    } else if (descendants.length <= 2) {
      level = 3;
    } else if (descendants.length <= 5) {
      level = 2;
    } else {
      level = 1;
    }

    return level;
  }

  private getDescendants(indicator: any, allIndicators: any[]): any[] {
    const children = allIndicators.filter(
      (ind) => ind.parent_id === indicator.id
    );
    let descendants = [...children];

    children.forEach((child) => {
      descendants = [
        ...descendants,
        ...this.getDescendants(child, allIndicators),
      ];
    });

    return descendants;
  }

  private determineProgressStatus(
    score: number | null,
    isGrey: boolean
  ): boolean {
    if (isGrey) return false;
    if (score === null) return true;
    return score < 100;
  }

  private buildProgressItems(
    indicator: any,
    projectIndicator: any
  ): Array<{ field: string; value: string }> {
    const items = [];

    // Use the indicator name as the main field
    let value = "0%";

    if (projectIndicator?.expected_score) {
      const scoreValue = Math.round(
        parseFloat(projectIndicator.expected_score)
      );

      // Add + or - based on expected_trend
      let trendSymbol = "";
      if (projectIndicator.expected_trend === "increase") {
        trendSymbol = "+";
      } else if (projectIndicator.expected_trend === "decrease") {
        trendSymbol = "-";
      }

      // Use absolute value and apply trend symbol
      const absoluteScore = Math.abs(scoreValue);
      value = `${trendSymbol}${absoluteScore}%`;
    } else {
      // Set to 0% when expected_score is not found in tbs_project_performance_indicator
      value = "0%";
    }

    items.push({
      field: indicator.name,
      value: value,
    });

    // Add additional items if indicator has description
    if (indicator.description && indicator.description !== indicator.name) {
      items.push({
        field: indicator.description,
        value: value,
      });
    }

    return items;
  }

  private buildAdditionalLevels(
    levelIndicators: any[],
    projectIndicators: any[],
    rootIndicators: any[]
  ): any[] {
    // Filter out indicators that are already children of root indicators
    const usedIndicatorIds = new Set();
    rootIndicators.forEach((root) => {
      if (root.children) {
        root.children.forEach((child) => usedIndicatorIds.add(child.id));
      }
    });

    const independentIndicators = levelIndicators.filter(
      (ind) => !usedIndicatorIds.has(ind.id)
    );

    return independentIndicators.map((indicator) => {
      const projectIndicator = projectIndicators.find(
        (pi) => pi.indicator_id === indicator.id
      );
      const score = projectIndicator?.expected_score
        ? parseFloat(projectIndicator.expected_score)
        : null;
      const level = this.calculateLevel(indicator, levelIndicators);

      return {
        name: indicator.name,
        level: level,
        onprogress: this.determineProgressStatus(score, indicator.is_grey),
        progressItem: this.buildProgressItems(indicator, projectIndicator),
      };
    });
  }

  /**
   * Private helper methods
   */

  private async getProjectTimelineActivities(projectId: string) {
    return await this.prisma.tbs_project_timeline.findMany({
      where: { project_id: projectId },
      include: {
        creator: {
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
      },
      orderBy: { created_at: "asc" },
    });
  }

  private getProjectPhases(): string[] {
    return [
      Project.Status.Framing,
      Project.Status.Qualification,
      Project.Status.ProblemSolving,
      Project.Status.Testing,
      Project.Status.Scale,
      Project.Status.DeploymentPlanning,
      Project.Status.Deployment,
    ];
  }

  private calculateProjectDuration(startDate: Date, endDate: Date): number {
    return Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );
  }

  private calculatePhaseEndDate(
    startDate: Date,
    duration: number,
    isLastPhase: boolean,
    projectEndDate: Date
  ): Date {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);

    // Ensure last phase ends on project end date
    if (isLastPhase) {
      endDate.setTime(projectEndDate.getTime());
    }

    return endDate;
  }

  private getPhaseActivities(
    activities: any[],
    phaseStartDate: Date,
    phaseEndDate: Date
  ): any[] {
    return activities.filter((activity) => {
      const activityDate = new Date(activity.created_at);
      return activityDate >= phaseStartDate && activityDate <= phaseEndDate;
    });
  }

  private createDefaultPhaseActivity(
    phase: string,
    phaseStartDate: Date,
    projectOwner: any
  ) {
    return [
      {
        event: `${phase} Started`,
        description: `Project entered ${phase} phase`,
        created_at: phaseStartDate,
        creator: projectOwner || null,
      },
    ];
  }

  private formatCreatorName(creator: any): string {
    if (!creator) return "System";

    if (creator.profile?.first_name) {
      return `${creator.profile.first_name} ${creator.profile.last_name || ""}`.trim();
    }

    return creator.email;
  }

  private mapActivitiesToTimelineFormat(activities: any[]) {
    return activities.map((activity) => ({
      event: activity.event,
      description: activity.description || `${activity.event} activity`,
      date: activity.created_at.toISOString(),
      creator: {
        name: this.formatCreatorName(activity.creator),
      },
    }));
  }

  private async handleFileOperations(
    tx: any,
    projectId: string,
    tenantId: string | null,
    updateDto: any
  ) {
    if (updateDto.files && updateDto.files.length > 0) {
      // Replace all files
      // await tx.tbm_document.deleteMany({
      //   where: { project_id: projectId },
      // });

      await tx.tbm_document.createMany({
        data: updateDto.files.map((url: string) => ({
          name: url.split("/").pop() || "Untitled Document",
          content: url,
          tenant_id: tenantId,
          project_id: projectId,
        })),
      });
    }

    // Handle remove operations
    if (updateDto.remove_files && updateDto.remove_files.length > 0) {
      await tx.tbm_document.deleteMany({
        where: {
          project_id: projectId,
          content: { in: updateDto.remove_files },
        },
      });
    }
  }

  private async handleImageOperations(
    tx: any,
    projectId: string,
    userId: string,
    updateDto: any
  ) {
    if (updateDto.images && updateDto.images.length > 0) {
      // Replace all images
      // await tx.tbs_project_image.deleteMany({
      //   where: { project_id: projectId },
      // });

      await tx.tbs_project_image.createMany({
        data: updateDto.images.map((url: string) => ({
          project_id: projectId,
          creator_id: userId,
          name: url.split("/").pop() || "Untitled Image",
          image_url: url,
          description: `Image updated on project update`,
        })),
      });
    }

    // Handle remove operations
    if (updateDto.remove_images && updateDto.remove_images.length > 0) {
      await tx.tbs_project_image.deleteMany({
        where: {
          project_id: projectId,
          image_url: { in: updateDto.remove_images },
        },
      });
    }
  }

  private buildProjectUpdateData(updateDto: UpdateProjectDto): any {
    const updateData: any = {};

    // Define field mappings with their validation/transformation logic
    const fieldMappings: Array<{
      source: keyof UpdateProjectDto;
      target?: string;
      transform?: (value: any) => any;
      validate?: (value: any) => any;
    }> = [
      // Simple string fields
      { source: "code" },
      { source: "name" },
      { source: "description" },
      { source: "country" },
      { source: "status" },
      { source: "currency" },
      { source: "tenant_id" },
      { source: "owner_id" },

      // Numeric fields with validation
      {
        source: "score",
        validate: (value) => this.validateNumericInput(value, "score", 0, 100),
      },
      {
        source: "budget",
        validate: (value) => this.validateNumericInput(value, "budget", 0),
      },

      // Array fields with validation
      {
        source: "domains",
        validate: (value) => this.validateArrayField(value, "domains"),
      },
      {
        source: "pillars",
        validate: (value) => this.validateArrayField(value, "pillars"),
      },

      // Date fields with transformation
      {
        source: "start_date",
        transform: (value) => (value ? new Date(value) : null),
      },
      {
        source: "end_date",
        transform: (value) => (value ? new Date(value) : null),
      },
    ];

    // Process each field mapping
    fieldMappings.forEach(({ source, target, transform, validate }) => {
      const sourceValue = updateDto[source];

      if (sourceValue !== undefined) {
        const targetField = target || source;
        let processedValue = sourceValue;

        // Apply validation first if provided
        if (validate) {
          processedValue = validate(processedValue);
        }

        // Apply transformation if provided
        if (transform) {
          processedValue = transform(processedValue);
        }

        updateData[targetField] = processedValue;
      }
    });

    return updateData;
  }

  private buildTimelineByPhases(
    project: any,
    timelineActivities: any[],
    statusColors: Record<string, string>
  ) {
    const phases = this.getProjectPhases();

    // Calculate phase date ranges based on project dates and activities
    const projectStartDate = project.start_date || new Date();
    const projectEndDate = project.end_date || new Date();

    // Calculate phase duration
    const totalDays = this.calculateProjectDuration(
      projectStartDate,
      projectEndDate
    );
    const phaseDuration = Math.ceil(totalDays / phases.length);

    return phases.map((phase, index) => {
      // Calculate phase dates
      const phaseStartDate = new Date(projectStartDate);
      phaseStartDate.setDate(phaseStartDate.getDate() + index * phaseDuration);

      const phaseEndDate = this.calculatePhaseEndDate(
        phaseStartDate,
        phaseDuration,
        index === phases.length - 1,
        projectEndDate
      );

      // Get activities for this phase
      let phaseActivities = this.getPhaseActivities(
        timelineActivities,
        phaseStartDate,
        phaseEndDate
      );

      // If no specific activities for this phase and it's the first phase, create a default one
      if (phaseActivities.length === 0 && index === 0) {
        phaseActivities = this.createDefaultPhaseActivity(
          phase,
          phaseStartDate,
          project.owner
        );
      }

      return {
        name: phase,
        startDate: phaseStartDate.toISOString().split("T")[0],
        endDate: phaseEndDate.toISOString().split("T")[0],
        color: statusColors[phase] || "#CCCCCC",
        activities: this.mapActivitiesToTimelineFormat(phaseActivities),
      };
    });
  }

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
