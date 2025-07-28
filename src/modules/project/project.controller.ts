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
import { ProjectTimelineResponse } from "./dto/project-timeline-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import {
  ProjectPerformanceValuePillars,
  ProjectStatuses,
} from "@/constants/project";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
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
    FileFieldsInterceptor(
      [
        { name: "files", maxCount: 10 },
        { name: "images", maxCount: 10 },
      ],
      {
        fileFilter: (req, file, cb) => {
          // Accept all files, no filtering
          cb(null, true);
        },
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB per file
        },
      }
    )
  )
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req,
    @UploadedFiles()
    uploadedFiles?: {
      files?: Express.Multer.File[];
      images?: Express.Multer.File[];
    }
  ) {
    let fileUrls: string[] = [];
    let imageUrls: string[] = [];

    // Upload files if they exist
    if (uploadedFiles?.files && uploadedFiles.files.length > 0) {
      fileUrls = await this.azureBlobStorageService.uploadFiles(
        uploadedFiles.files
      );
    }

    // Upload images if they exist
    if (uploadedFiles?.images && uploadedFiles.images.length > 0) {
      imageUrls = await this.azureBlobStorageService.uploadFiles(
        uploadedFiles.images
      );
    }

    return this.projectService.create(
      {
        ...createProjectDto,
        files: fileUrls.length > 0 ? fileUrls : createProjectDto.files,
        images: imageUrls.length > 0 ? imageUrls : createProjectDto.images,
      },
      req.user
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
    return this.projectService.findAll(query, req.user);
  }

  @Get("statistics")
  @RequirePermission("project:read")
  getStatistics(@Request() req) {
    return this.projectService.getProjectStatistics(req.user);
  }

  @Get("statuses")
  getStatus() {
    return ProjectStatuses;
  }

  @Get("performance-value-pillars")
  getPerformanceValuePillars() {
    return ProjectPerformanceValuePillars;
  }

  @Get("performance-pyramid/:id")
  @RequirePermission("project:read")
  getProjectPerformancePyramid(@Param("id") id: string, @Request() req) {
    return this.projectService.getProjectPerformancePyramidById(id, req.user);
  }

  @Get("timeline/:id")
  @RequirePermission("project:read")
  getProjectTimeline(
    @Param("id") id: string,
    @Request() req
  ): Promise<ProjectTimelineResponse> {
    return this.projectService.getProjectTimelineById(id, req.user);
  }

  @Get(":id")
  @RequirePermission("project:read")
  findOne(@Param("id") id: string, @Request() req) {
    return this.projectService.findOne(id, req.user);
  }

  @Patch(":id")
  @RequirePermission("project:update")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "files", maxCount: 10 },
        { name: "images", maxCount: 10 },
      ],
      {
        fileFilter: (req, file, cb) => {
          // Accept all files, no filtering
          cb(null, true);
        },
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB per file
        },
      }
    )
  )
  async update(
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() req,
    @UploadedFiles()
    uploadedFiles?: {
      files?: Express.Multer.File[];
      images?: Express.Multer.File[];
    }
  ) {
    let fileUrls: string[] = [];
    let imageUrls: string[] = [];

    // Upload files if they exist
    if (uploadedFiles?.files && uploadedFiles.files.length > 0) {
      fileUrls = await this.azureBlobStorageService.uploadFiles(
        uploadedFiles.files
      );
    }

    // Upload images if they exist
    if (uploadedFiles?.images && uploadedFiles.images.length > 0) {
      imageUrls = await this.azureBlobStorageService.uploadFiles(
        uploadedFiles.images
      );
    }

    return this.projectService.update(
      id,
      {
        ...updateProjectDto,
        files: fileUrls.length > 0 ? fileUrls : updateProjectDto.files,
        images: imageUrls.length > 0 ? imageUrls : updateProjectDto.images,
      },
      req.user
    );
  }

  @Delete(":id")
  @RequirePermission("project:delete")
  remove(@Param("id") id: string, @Request() req) {
    return this.projectService.remove(id, req.user);
  }

  @Post(":id/statuses")
  @RequirePermission("project:update")
  addStatus(
    @Param("id") id: string,
    @Body() createStatusDto: CreateProjectStatusDto,
    @Request() req
  ) {
    return this.projectService.addStatus(id, createStatusDto, req.user);
  }

  @Get(":id/statuses")
  @RequirePermission("project:read")
  getStatuses(@Param("id") id: string, @Request() req) {
    return this.projectService.getStatuses(id, req.user);
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
      req.user
    );
  }
}
