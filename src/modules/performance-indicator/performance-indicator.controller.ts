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
} from "@nestjs/common";
import { PerformanceIndicatorService } from "./performance-indicator.service";
import { CreatePerformanceIndicatorDto } from "./dto/create-performance-indicator.dto";
import { UpdatePerformanceIndicatorDto } from "./dto/update-performance-indicator.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { Role } from "@/constants/role";

@Controller("performance-indicators")
@UseGuards(JwtAuthGuard)
export class PerformanceIndicatorController {
  constructor(
    private readonly performanceIndicatorService: PerformanceIndicatorService
  ) {}

  @Post()
  create(@Body() createDto: CreatePerformanceIndicatorDto, @Request() req) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.create(createDto);
  }

  @Get()
  findAll(
    @Query()
    query: PaginationDto & {
      parent_id?: string;
      has_parent?: string;
      q?: string;
    },
    @Request() req
  ) {
    this.checkAdminPermission(req.user);
    const result = this.performanceIndicatorService.findAll(query);

    return result;
  }

  @Get("hierarchy")
  getHierarchy(@Request() req) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.getHierarchy();
  }

  @Get("statistics")
  getStatistics(@Request() req) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.getStatistics();
  }

  @Get("available-parents")
  getAvailableParents(@Request() req, @Query("exclude") excludeId?: string) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.getAvailableParents(excludeId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateDto: UpdatePerformanceIndicatorDto,
    @Request() req
  ) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.update(id, updateDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req) {
    this.checkAdminPermission(req.user);
    return this.performanceIndicatorService.remove(id);
  }

  private checkAdminPermission(user: any) {
    const userRole = user.role?.name;
    if (!userRole || ![Role.Admin, Role.StandardUser].includes(userRole)) {
      throw new ForbiddenException(
        "Only admin and standard user can manage performance indicators"
      );
    }
  }
}
