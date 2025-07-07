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
import { TenantService } from "./tenant.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Controller("tenants")
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  create(@Body() createTenantDto: CreateTenantDto, @Request() req) {
    this.checkPermission(req.user, "tenant:create");
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  findAll(
    @Query()
    query: PaginationDto & {
      country?: string;
      has_leader?: string;
      q?: string;
    },
    @Request() req
  ) {
    this.checkPermission(req.user, "tenant:read");
    return this.tenantService.findAll(query);
  }

  @Get("statistics")
  getStatistics(@Request() req) {
    this.checkPermission(req.user, "tenant:read");
    return this.tenantService.getStatistics();
  }

  @Get("available-leaders")
  getAvailableLeaders(@Request() req) {
    this.checkPermission(req.user, "tenant:read");
    return this.tenantService.getAvailableLeaders();
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "tenant:read");
    return this.tenantService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @Request() req
  ) {
    this.checkPermission(req.user, "tenant:update");
    return this.tenantService.update(id, updateTenantDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "tenant:delete");
    return this.tenantService.remove(id);
  }

  @Post(":id/employees/:userId")
  addEmployee(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Request() req
  ) {
    this.checkPermission(req.user, "tenant:update");
    return this.tenantService.addEmployee(id, userId);
  }

  @Delete(":id/employees/:userId")
  removeEmployee(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Request() req
  ) {
    this.checkPermission(req.user, "tenant:update");
    return this.tenantService.removeEmployee(id, userId);
  }

  @Get(":id/employees")
  getEmployees(
    @Param("id") id: string,
    @Query() query: PaginationDto,
    @Request() req
  ) {
    this.checkPermission(req.user, "tenant:read");
    return this.tenantService.getEmployees(id, query);
  }

  private checkPermission(user: any, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Insufficient permissions: ${permission} required`
      );
    }
  }
}
