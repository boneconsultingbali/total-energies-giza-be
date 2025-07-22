import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  Put,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { Express } from "express";
import { ProjectService } from "./project.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { CreateProjectStatusDto } from "./dto/create-project-status.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import {
  ProjectPerformanceValuePillars,
  ProjectStatuses,
} from "@/constants/project";
import { FilesInterceptor } from "@nestjs/platform-express";
import { AzureBlobStorageService } from "@/storage/azure-blob-storage/azure-blob-storage.service";

@Controller("projects")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly azureBlobStorageService: AzureBlobStorageService
  ) {}

  @Post()
  @RequirePermission("project:create")
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      fileFilter: (req, file, cb) => {
        // Accept all files, no filtering
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
    })
  )
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    let fileUrls: string[] = [];

    // Upload files if they exist
    if (files && files.length > 0) {
      fileUrls = await this.azureBlobStorageService.uploadFiles(files);
    }

    console.log({
      body: createProjectDto,
      files: fileUrls,
    });

    return this.projectService.create(
      {
        ...createProjectDto,
        files: fileUrls.length > 0 ? fileUrls : createProjectDto.files,
      },
      req.user.id
    );
  }

  @Get()
  @RequirePermission("project:read")
  findAll(
    @Query()
    query: PaginationDto & {
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
    },
    @Request() req
  ) {
    return this.projectService.findAll(query, req.user.id, req.user.role?.name);
  }

  @Get("statistics")
  @RequirePermission("project:read")
  getStatistics(@Request() req) {
    return this.projectService.getProjectStatistics(
      req.user.id,
      req.user.role?.name
    );
  }

  @Get("statuses")
  getStatus() {
    return ProjectStatuses;
  }

  @Get("performance-value-pillars")
  getPerformanceValuePillars() {
    return ProjectPerformanceValuePillars;
  }

  @Get(":id")
  @RequirePermission("project:read")
  findOne(@Param("id") id: string, @Request() req) {
    return this.projectService.findOne(id, req.user.id, req.user.role?.name);
  }

  @Patch(":id")
  @RequirePermission("project:update")
  update(
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() req
  ) {
    return this.projectService.update(
      id,
      updateProjectDto,
      req.user.id,
      req.user.role?.name
    );
  }

  @Delete(":id")
  @RequirePermission("project:delete")
  remove(@Param("id") id: string, @Request() req) {
    return this.projectService.remove(id, req.user.id, req.user.role?.name);
  }

  @Post(":id/statuses")
  @RequirePermission("project:update")
  addStatus(
    @Param("id") id: string,
    @Body() createStatusDto: CreateProjectStatusDto,
    @Request() req
  ) {
    return this.projectService.addStatus(
      id,
      createStatusDto,
      req.user.id,
      req.user.role?.name
    );
  }

  @Get(":id/statuses")
  @RequirePermission("project:read")
  getStatuses(@Param("id") id: string, @Request() req) {
    return this.projectService.getStatuses(
      id,
      req.user.id,
      req.user.role?.name
    );
  }

  @Put(":id/indicators/:indicatorId/score")
  @RequirePermission("project:update")
  updateIndicatorScore(
    @Param("id") id: string,
    @Param("indicatorId") indicatorId: string,
    @Body("score") score: number,
    @Request() req
  ) {
    return this.projectService.updateIndicatorScore(
      id,
      indicatorId,
      score,
      req.user.id,
      req.user.role?.name
    );
  }
}
