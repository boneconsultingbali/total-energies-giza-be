import { Module } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";
import { PrismaModule } from "../../database/prisma/prisma.module";

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [PrismaModule],
  exports: [DashboardService],
})
export class DashboardModule {}
