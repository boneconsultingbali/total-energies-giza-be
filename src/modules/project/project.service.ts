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
import { Prisma } from "@prisma/client";

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

      await this.createProjectTimeline({
        tx,
        project_id: project.id,
        user,
        event: "Project created",
        description: "Initial project creation",
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
      await this.createProjectTimeline({
        tx,
        project_id: id,
        user,
        event: "Project updated",
        description: "Project updated",
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
      await this.createProjectTimeline({
        tx,
        project_id: projectId,
        user,
        event: "Project status updated",
        description: `Status changed to ${createStatusDto.status}`,
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

    // Get all parent performance indicators (has_parent = false)
    const parentIndicators =
      await this.prisma.tbm_performance_indicator.findMany({
        where: { parent_id: null },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          children: {
            select: {
              id: true,
              name: true,
              description: true,
              unit: true,
              min_score: true,
              max_score: true,
              is_grey: true,
            },
          },
          _count: {
            select: {
              children: true,
              projects: true,
            },
          },
        },
      });

    // Get project performance indicators for this project
    const projectIndicators =
      await this.prisma.tbs_project_performance_indicator.findMany({
        where: { project_id: projectId },
        select: {
          indicator_id: true,
          expected_trend: true,
          expected_score: true,
        },
      });

    // Create a map for quick lookup of project indicators
    const projectIndicatorMap = new Map();
    projectIndicators.forEach((pi) => {
      projectIndicatorMap.set(pi.indicator_id, {
        expected_trend: pi.expected_trend,
        expected_score: pi.expected_score,
      });
    });

    // Add expected_trend and expected_score to parent indicators and their children
    const result = parentIndicators.map((indicator) => {
      const projectData = projectIndicatorMap.get(indicator.id);

      // Add expected_trend and expected_score to children
      const childrenWithProjectData = indicator.children.map((child) => {
        const childProjectData = projectIndicatorMap.get(child.id);
        return {
          ...child,
          expected_trend: childProjectData?.expected_trend || null,
          expected_score: childProjectData?.expected_score || null,
        };
      });

      return {
        ...indicator,
        expected_trend: projectData?.expected_trend || null,
        expected_score: projectData?.expected_score || null,
        children: childrenWithProjectData,
      };
    });

    return result;
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

    // If no timeline activities, return phases with empty dates
    if (timelineActivities.length === 0) {
      const phases = this.getProjectPhases();
      return phases.map((phase) => ({
        name: phase,
        startDate: "",
        endDate: "",
        color: ProjectStatusColors[phase] || "#CCCCCC",
        activities: [],
      }));
    }

    // Build timeline with actual dates and activities
    const timeline = this.buildTimelineWithActivities(
      project,
      timelineActivities,
      ProjectStatusColors
    );

    return timeline;
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

  private getActivitiesForPhase(activities: any[], targetPhase: string): any[] {
    const phaseActivities = [];

    for (const activity of activities) {
      // Check if the activity description or event mentions the target phase
      const activityText =
        `${activity.event} ${activity.description || ""}`.toLowerCase();
      const targetPhaseText = targetPhase.toLowerCase();

      // Check for exact phase name matches in the activity
      if (activityText.includes(targetPhaseText)) {
        phaseActivities.push(activity);
      }
      // Check for status change activities that mention the target phase
      else if (
        activity.event.toLowerCase().includes("status") &&
        activityText.includes(`to ${targetPhaseText}`)
      ) {
        phaseActivities.push(activity);
      }
      // Check for alternative phase names or keywords
      else if (this.isActivityForPhase(activity, targetPhase)) {
        phaseActivities.push(activity);
      }
      // Default behavior: put general activities in Framing phase
      else if (
        targetPhase === Project.Status.Framing &&
        !this.hasSpecificPhaseActivity(activity)
      ) {
        phaseActivities.push(activity);
      }
    }

    return phaseActivities;
  }

  private groupActivitiesByPhaseChronologically(
    activities: any[],
    phases: string[]
  ): Array<{ phase: string; activities: any[] }> {
    const result = [];
    let currentPhaseGroup = null;

    // Sort activities by created_at to ensure chronological order
    const sortedActivities = [...activities].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const activity of sortedActivities) {
      // Determine which phase this activity belongs to
      const activityPhase = this.determineActivityPhase(activity, phases);

      // If this is a different phase from the current group, start a new group
      if (!currentPhaseGroup || currentPhaseGroup.phase !== activityPhase) {
        currentPhaseGroup = {
          phase: activityPhase,
          activities: [],
        };
        result.push(currentPhaseGroup);
      }

      // Add activity to current phase group
      currentPhaseGroup.activities.push(activity);
    }

    return result;
  }

  private determineActivityPhase(activity: any, phases: string[]): string {
    const activityText =
      `${activity.event} ${activity.description || ""}`.toLowerCase();

    // Check for status change activities first (highest priority)
    if (activity.event.toLowerCase().includes("status")) {
      for (const phase of phases) {
        if (activityText.includes(`to ${phase.toLowerCase()}`)) {
          return phase;
        }
      }
    }

    // Check for exact phase name matches
    for (const phase of phases) {
      if (activityText.includes(phase.toLowerCase())) {
        return phase;
      }
    }

    // Check for phase-specific keywords
    for (const phase of phases) {
      if (this.isActivityForPhase(activity, phase)) {
        return phase;
      }
    }

    // Default to Framing phase for general activities
    return Project.Status.Framing;
  }

  private isActivityForPhase(activity: any, targetPhase: string): boolean {
    const activityText =
      `${activity.event} ${activity.description || ""}`.toLowerCase();

    // Define phase-specific keywords
    const phaseKeywords: Record<string, string[]> = {
      [Project.Status.Framing]: ["created", "initiated", "started", "framing"],
      [Project.Status.Qualification]: ["qualification", "qualified", "qualify"],
      [Project.Status.ProblemSolving]: [
        "problem solving",
        "problem-solving",
        "solving",
      ],
      [Project.Status.Testing]: ["testing", "test", "tested"],
      [Project.Status.Scale]: ["scale", "scaling", "scaled"],
      [Project.Status.DeploymentPlanning]: [
        "deployment planning",
        "planning",
        "plan",
      ],
      [Project.Status.Deployment]: ["deployment", "deployed", "deploy"],
    };

    const keywords = phaseKeywords[targetPhase] || [];
    return keywords.some((keyword) => activityText.includes(keyword));
  }

  private hasSpecificPhaseActivity(activity: any): boolean {
    const phases = this.getProjectPhases();
    const activityText =
      `${activity.event} ${activity.description || ""}`.toLowerCase();

    // Check if this activity specifically mentions any phase (except general project activities)
    for (const phase of phases) {
      if (
        phase !== Project.Status.Framing &&
        (activityText.includes(phase.toLowerCase()) ||
          this.isActivityForPhase(activity, phase))
      ) {
        return true;
      }
    }

    return false;
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
        start_date: phaseStartDate,
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
      date: (activity.start_date || activity.created_at).toISOString(),
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

  private buildTimelineWithActivities(
    project: any,
    timelineActivities: any[],
    statusColors: Record<string, string>
  ) {
    // Build timeline chronologically, allowing phases to repeat
    const timeline = [];
    const phases = this.getProjectPhases();

    // Group activities by phases in chronological order
    const phaseGroups = this.groupActivitiesByPhaseChronologically(
      timelineActivities,
      phases
    );

    // Create timeline entries for each phase group
    for (const phaseGroup of phaseGroups) {
      const { phase, activities } = phaseGroup;

      // Set dates based on actual activity dates from database if available
      let startDate = "";
      let endDate = "";

      if (activities.length > 0) {
        // Use start_date and end_date from database, fall back to created_at if not available
        const activityDates = activities
          .map((a) => {
            const startTime = a.start_date
              ? new Date(a.start_date).getTime()
              : null;
            const endTime = a.end_date ? new Date(a.end_date).getTime() : null;
            const createdTime = new Date(a.created_at).getTime();

            return {
              start: startTime || createdTime,
              end: endTime || createdTime,
            };
          })
          .filter((dates) => dates.start && dates.end);

        if (activityDates.length > 0) {
          const minStartDate = Math.min(...activityDates.map((d) => d.start));
          const maxEndDate = Math.max(...activityDates.map((d) => d.end));

          startDate = new Date(minStartDate).toISOString().split("T")[0];
          endDate = new Date(maxEndDate).toISOString().split("T")[0];
        }
      }

      timeline.push({
        name: phase,
        startDate,
        endDate,
        color: statusColors[phase] || "#CCCCCC",
        activities: this.mapActivitiesToTimelineFormat(activities),
      });
    }

    // Merge timeline entries with same dates and phase
    const mergedTimeline = this.mergeTimelineEntriesWithSameDates(timeline);

    // Add empty phases that haven't been used yet
    for (const phase of phases) {
      const hasPhaseInTimeline = mergedTimeline.some((t) => t.name === phase);
      if (!hasPhaseInTimeline) {
        mergedTimeline.push({
          name: phase,
          startDate: "",
          endDate: "",
          color: statusColors[phase] || "#CCCCCC",
          activities: [],
        });
      }
    }

    return mergedTimeline;
  }

  private mergeTimelineEntriesWithSameDates(timeline: any[]): any[] {
    const merged = [];
    const processedEntries = new Set();

    for (let i = 0; i < timeline.length; i++) {
      if (processedEntries.has(i)) continue;

      const currentEntry = timeline[i];
      const mergedEntry = {
        name: currentEntry.name,
        startDate: currentEntry.startDate,
        endDate: currentEntry.endDate,
        color: currentEntry.color,
        activities: [...currentEntry.activities],
      };

      // Look for other entries with the same phase, startDate, and endDate
      for (let j = i + 1; j < timeline.length; j++) {
        if (processedEntries.has(j)) continue;

        const otherEntry = timeline[j];

        // Check if same phase and same dates (including both being empty)
        if (
          otherEntry.name === currentEntry.name &&
          otherEntry.startDate === currentEntry.startDate &&
          otherEntry.endDate === currentEntry.endDate &&
          currentEntry.startDate !== "" && // Only merge non-empty entries
          currentEntry.endDate !== ""
        ) {
          // Merge activities, preserving chronological order
          mergedEntry.activities.push(...otherEntry.activities);
          processedEntries.add(j);
        }
      }

      // Sort activities chronologically within the merged entry
      mergedEntry.activities.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      merged.push(mergedEntry);
      processedEntries.add(i);
    }

    return merged;
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

  private async createProjectTimeline({
    tx,
    project_id,
    user,
    event,
    description,
  }: {
    tx: Prisma.TransactionClient;
    project_id: string;
    user: CurrentUser;
    event: string;
    description: string;
  }) {
    this.logOperation("Creating project timeline entry", project_id, user.id);

    // Find the last timeline entry to update its end_date
    const lastEntries = await tx.tbs_project_timeline.findMany({
      where: { project_id },
      orderBy: { created_at: "desc" },
      take: 1,
    });

    // Update the last entry's end_date if it exists and doesn't have an end_date yet
    if (lastEntries.length > 0) {
      const lastEntry = lastEntries[0];
      if (lastEntry.created_at && !lastEntry.end_date) {
        await tx.tbs_project_timeline.update({
          where: { id: lastEntry.id },
          data: { end_date: new Date() },
        });
      }
    }

    // Create the new timeline entry
    return await tx.tbs_project_timeline.create({
      data: {
        project_id: project_id,
        creator_id: user.id,
        start_date: new Date(),
        event,
        description: `${description} by ${user.profile?.first_name || user.email}`,
      },
    });
  }
}
