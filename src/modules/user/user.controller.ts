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
import { PaginationDto } from "../../common/dto/pagination.dto";
import { UserInterceptor } from "./user.interceptor";

@Controller("users")
@UseGuards(JwtAuthGuard)
@UseInterceptors(UserInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    this.checkPermission(req.user, "user:create");
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll(
    @Query()
    query: PaginationDto & { role?: string; active?: string; q?: string },
    @Request() req
  ) {
    this.checkPermission(req.user, "user:read");
    return this.userService.findAll(query);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:read");
    const result = await this.userService.findOne(id);

    return result;
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req
  ) {
    this.checkPermission(req.user, "user:update");
    return this.userService.update(id, updateUserDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:delete");
    return this.userService.remove(id);
  }

  @Post(":id/anonymize")
  anonymize(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:anonymize");
    return this.userService.anonymize(id);
  }

  @Post(":id/activate")
  activate(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:activate");
    return this.userService.activate(id);
  }

  @Post(":id/deactivate")
  deactivate(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:activate");
    return this.userService.deactivate(id);
  }

  @Get(":id/login-history")
  getLoginHistory(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:view-logs");
    return this.userService.getLoginHistory(id);
  }

  @Post(":id/unlock")
  unlock(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "user:unlock");
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
      this.checkPermission(req.user, "user:update");
    }
    return this.userService.updatePreferences(id, preferences);
  }

  @Get("roles/available")
  getAvailableRoles(@Request() req) {
    // Only superadmin can see all roles, admin can see admin and user roles
    if (req.user.role?.name === "superadmin") {
      return this.userService.getAvailableRoles([
        "superadmin",
        "admin",
        "user",
      ]);
    } else if (req.user.role?.name === "admin") {
      return this.userService.getAvailableRoles(["admin", "user"]);
    } else {
      throw new ForbiddenException("Insufficient permissions to view roles");
    }
  }

  private checkPermission(user: any, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Insufficient permissions: ${permission} required`
      );
    }
  }
}
