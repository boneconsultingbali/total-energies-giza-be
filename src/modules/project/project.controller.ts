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
  ForbiddenException,
  Put,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateProjectStatusDto } from './dto/create-project-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @Request() req) {
    this.checkPermission(req.user, 'project:create');
    return this.projectService.create(createProjectDto, req.user.id);
  }

  @Get()
  findAll(@Query() query: PaginationDto & { status?: string; owner_id?: string; tenant_id?: string; q?: string }, @Request() req) {
    this.checkPermission(req.user, 'project:read');
    return this.projectService.findAll(query, req.user.id, req.user.role?.name);
  }

  @Get('statistics')
  getStatistics(@Request() req) {
    this.checkPermission(req.user, 'project:read');
    return this.projectService.getProjectStatistics(req.user.id, req.user.role?.name);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    this.checkPermission(req.user, 'project:read');
    return this.projectService.findOne(id, req.user.id, req.user.role?.name);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto, @Request() req) {
    this.checkPermission(req.user, 'project:update');
    return this.projectService.update(id, updateProjectDto, req.user.id, req.user.role?.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    this.checkPermission(req.user, 'project:delete');
    return this.projectService.remove(id, req.user.id, req.user.role?.name);
  }

  @Post(':id/statuses')
  addStatus(@Param('id') id: string, @Body() createStatusDto: CreateProjectStatusDto, @Request() req) {
    this.checkPermission(req.user, 'project:update');
    return this.projectService.addStatus(id, createStatusDto, req.user.id, req.user.role?.name);
  }

  @Get(':id/statuses')
  getStatuses(@Param('id') id: string, @Request() req) {
    this.checkPermission(req.user, 'project:read');
    return this.projectService.getStatuses(id, req.user.id, req.user.role?.name);
  }

  @Put(':id/indicators/:indicatorId/score')
  updateIndicatorScore(
    @Param('id') id: string,
    @Param('indicatorId') indicatorId: string,
    @Body('score') score: number,
    @Request() req,
  ) {
    this.checkPermission(req.user, 'project:update');
    return this.projectService.updateIndicatorScore(id, indicatorId, score, req.user.id, req.user.role?.name);
  }

  private checkPermission(user: any, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(`Insufficient permissions: ${permission} required`);
    }
  }
}