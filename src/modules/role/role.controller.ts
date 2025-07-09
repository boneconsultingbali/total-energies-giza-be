import { Controller, Get } from "@nestjs/common";
import { RoleService } from "./role.service";

@Controller("role")
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async fetchRoles() {
    return this.roleService.fetchRoles();
  }

  // Permissions

  @Get("permission")
  async fetchPermissions() {
    return this.roleService.fetchPermissions();
  }
}
