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
  UseInterceptors,
  Request,
  ForbiddenException,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { UserInterceptor } from "./user.interceptor";
import { Role } from "@/constants/role";
import { UserDomains } from "@/constants/user";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(UserInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("code/:id")
  async validateCode(@Param("id") id: string) {
    const isValid = await this.userService.checkExistingCode(id);

    if (!isValid) {
      throw new ForbiddenException("Invalid or already used code");
    }

    return { valid: true, message: "Code is valid" };
  }

  @Post()
  @RequirePermission("user:create")
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @RequirePermission("user:read")
  findAll(
    @Query()
    query: PaginationDto & { role?: string; active?: string; q?: string }
  ) {
    return this.userService.findAll(query);
  }

  @Get("domains")
  getDomains() {
    return UserDomains;
  }

  @Get(":id")
  @RequirePermission("user:read")
  async findOne(@Param("id") id: string) {
    const result = await this.userService.findOne(id);

    return result;
  }

  @Patch(":id")
  @RequirePermission("user:update")
  update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(":id")
  @RequirePermission("user:delete")
  remove(@Param("id") id: string) {
    return this.userService.remove(id);
  }

  @Post(":id/anonymize")
  @RequirePermission("user:anonymize")
  anonymize(@Param("id") id: string) {
    return this.userService.anonymize(id);
  }

  @Post(":id/activate")
  @RequirePermission("user:activate")
  activate(@Param("id") id: string) {
    return this.userService.activate(id);
  }

  @Post(":id/deactivate")
  @RequirePermission("user:activate")
  deactivate(@Param("id") id: string) {
    return this.userService.deactivate(id);
  }

  @Get(":id/login-history")
  @RequirePermission("user:view-logs")
  getLoginHistory(@Param("id") id: string) {
    return this.userService.getLoginHistory(id);
  }

  @Post(":id/unlock")
  @RequirePermission("user:unlock")
  unlock(@Param("id") id: string) {
    return this.userService.unlock(id);
  }

  @Patch(":id/preferences")
  updatePreferences(
    @Param("id") id: string,
    @Body() preferences: any,
    @Request() req
  ) {
    // Users can update their own preferences, or users with user:update permission can update any
    if (req.user.id !== id) {
      if (!req.user.permissions.includes("user:update")) {
        throw new ForbiddenException(
          `Insufficient permissions: user:update required`
        );
      }
    }
    return this.userService.updatePreferences(id, preferences);
  }

  @Get("roles/available")
  getAvailableRoles(@Request() req) {
    // Only admin can see all roles, admin can see admin and user roles
    if (req.user.role?.name === Role.Admin) {
      return this.userService.getAvailableRoles([
        Role.Admin,
        Role.StandardUser,
        Role.Viewer,
      ]);
    } else if (req.user.role?.name === Role.StandardUser) {
      return this.userService.getAvailableRoles([
        Role.StandardUser,
        Role.Viewer,
      ]);
    } else {
      throw new ForbiddenException("Insufficient permissions to view roles");
    }
  }
}
