import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { DashboardResponseDto } from "./dto/dashboard-response.dto";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("stats")
  @RequirePermission("project:read")
  async getDashboardStats(@Request() req): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboardStats(req.user);
  }
}
