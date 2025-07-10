import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from "@nestjs/common";
import { RoleService } from "./role.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { AssignPermissionDto } from "./dto/assign-permission.dto";

@Controller("role")
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Patch("assign/:id")
  async assignPermission(
    @Request() req,
    @Param("id") id: string,
    @Body() assignPermissionDto: AssignPermissionDto
  ) {
    // this.checkPermission(req.user, "permission:assign");
    return this.roleService.assignPermissions({
      role_id: id,
      assignPermissionDto: assignPermissionDto,
    });
  }

  @Get()
  async fetchRoles(@Request() req) {
    // this.checkPermission(req.user, "role:read");
    return this.roleService.fetchRoles();
  }

  @Get(":id")
  async fetchRoleById(@Request() req, @Param("id") id: string) {
    // this.checkPermission(req.user, "role:read");
    return this.roleService.fetchRoleById(id);
  }

  @Post()
  async createRole(@Body() createRoleDto: CreateRoleDto, @Request() req) {
    // this.checkPermission(req.user, "role:create");
    return this.roleService.createRole(createRoleDto);
  }

  @Patch(":id")
  async updateRole(
    @Request() req,
    @Body() updateRoleDto: UpdateRoleDto,
    @Param("id") id: string
  ) {
    // this.checkPermission(req.user, "role:update");
    return this.roleService.updateRole(id, updateRoleDto);
  }

  // Permissions
  @Get("permission")
  async fetchPermissions(@Request() req) {
    // this.checkPermission(req.user, "permission:read");
    return this.roleService.fetchPermissions();
  }

  @Post("permission")
  async createPermission(
    @Body() createPermissionDto: CreatePermissionDto,
    @Request() req
  ) {
    console.log(req.user);

    // this.checkPermission(req.user, "permission:create");
    return this.roleService.createPermission(createPermissionDto);
  }

  @Patch("permission/:id")
  async updatePermission(
    @Request() req,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @Param("id") id: string
  ) {
    // this.checkPermission(req.user, "permission:update");
    return this.roleService.updatePermission(id, updatePermissionDto);
  }

  private checkPermission(user: any, permission: string) {
    console.log(user.permissions);

    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Insufficient permissions: ${permission} required`
      );
    }
  }
}
