import { Injectable } from "@nestjs/common";
import { BaseService } from "../../common/services/base.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CurrentUser } from "../../types/user.types";
import {
  DashboardResponseDto,
  DashboardStatsDto,
  ProjectStageDto,
  CountryProjectDto,
  ValuePillarDto,
} from "./dto/dashboard-response.dto";
import { Project } from "@/constants/project";
import { countries } from "@/constants/countries";

@Injectable()
export class DashboardService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async getDashboardStats(user: CurrentUser): Promise<DashboardResponseDto> {
    this.logOperation("Getting dashboard statistics", undefined, user.id);

    // Build access control conditions
    const accessConditions = this.buildAccessControlConditions({
      userId: user.id,
      userRole: user.role?.name,
      checkOwnership: true,
      checkTenantAccess: true,
    });

    const where = accessConditions.length > 0 ? { AND: accessConditions } : {};

    // Run all queries in parallel for better performance
    const [
      totalProjects,
      projectsByStatus,
      projectsByCountry,
      projectsWithPillars,
      totalBudget,
      completedProjects,
    ] = await Promise.all([
      this.prisma.tbm_project.count({ where }),
      this.prisma.tbm_project.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      this.prisma.tbm_project.groupBy({
        by: ["country"],
        where: { ...where, country: { not: null } },
        _count: true,
      }),
      this.prisma.tbm_project.findMany({
        where: { ...where, pillars: { isEmpty: false } },
        select: { pillars: true },
      }),
      this.prisma.tbm_project.aggregate({
        where,
        _sum: { budget: true },
      }),
      this.prisma.tbm_project.count({
        where: {
          ...where,
          status: Project.Status.Deployment,
        },
      }),
    ]);

    // Calculate active projects (all except completed)
    const activeProjects = totalProjects - completedProjects;

    // Build dashboard response
    return {
      stats: this.buildStatsData(totalProjects, activeProjects, completedProjects, totalBudget._sum.budget?.toNumber()),
      projectStages: this.buildProjectStagesData(projectsByStatus),
      mapCountries: this.buildMapCountriesData(projectsByCountry),
      valuePillars: this.buildValuePillarsData(projectsWithPillars, totalProjects),
    };
  }

  private buildStatsData(
    totalProjects: number,
    activeProjects: number,
    completedProjects: number,
    totalBudget: number | null
  ): DashboardStatsDto[] {
    const formatBudget = (budget: number | null): string => {
      if (!budget) return "$0";
      
      if (budget >= 1000000) {
        return `$${(budget / 1000000).toFixed(1)}M`;
      } else if (budget >= 1000) {
        return `$${(budget / 1000).toFixed(1)}K`;
      }
      return `$${budget.toFixed(0)}`;
    };

    return [
      {
        label: "Total Projects",
        value: totalProjects.toString(),
        color: "blue",
        icon: "mdi-chart-line",
        changeText: "+12", // You can calculate this based on previous period data
      },
      {
        label: "Active Projects",
        value: activeProjects.toString(),
        changeText: "+8",
        color: "green",
        icon: "mdi-trending-up",
      },
      {
        label: "Completed Projects",
        value: completedProjects.toString(),
        changeText: "+5",
        color: "orange",
        icon: "mdi-file-document-check-outline",
        isNegative: false,
      },
      {
        label: "Total Budget",
        value: formatBudget(totalBudget),
        changeText: "-2.1%", // You can calculate this based on previous period data
        color: "purple",
        icon: "mdi-currency-usd",
        isNegative: true,
      },
    ];
  }

  private buildProjectStagesData(projectsByStatus: any[]): ProjectStageDto[] {
    // Map project statuses to stages with colors
    const stageColorMap = {
      [Project.Status.Framing]: "#A5B4FC",
      [Project.Status.Qualification]: "#BFDBFE",
      [Project.Status.ProblemSolving]: "#FEF3C7",
      [Project.Status.Testing]: "#FED7AA",
      [Project.Status.Scale]: "#DDD6FE",
      [Project.Status.DeploymentPlanning]: "#BFDBFE",
      [Project.Status.Deployment]: "#BBF7D0",
    };

    // Create a map for quick lookup
    const statusCountMap = new Map();
    projectsByStatus.forEach((item) => {
      statusCountMap.set(item.status, item._count);
    });

    // Build stages data ensuring all stages are included
    const allStages = [
      Project.Status.Framing,
      Project.Status.Qualification,
      Project.Status.ProblemSolving,
      Project.Status.Testing,
      Project.Status.Scale,
      Project.Status.DeploymentPlanning,
      Project.Status.Deployment,
    ];

    return allStages.map((stage) => ({
      name: stage,
      count: statusCountMap.get(stage) || 0,
      color: stageColorMap[stage] || "#CCCCCC",
    }));
  }

  private buildMapCountriesData(projectsByCountry: any[]): CountryProjectDto[] {
    // Map countries with flag URLs
    const countryMap = new Map();
    countries.forEach((country) => {
      countryMap.set(country.name.common, {
        code: country.name.common.substring(0, 2).toUpperCase(),
        flag: country.flags.svg,
      });
    });

    // Color palette for countries
    const colors = ["#6352ce", "#0cb9c5", "#1e88e5", "#8e24aa", "#43a047", "#ff7043"];

    return projectsByCountry
      .sort((a, b) => b._count - a._count) // Sort by project count descending
      .slice(0, 10) // Take top 10 countries
      .map((item, index) => {
        const countryInfo = countryMap.get(item.country) || {
          code: item.country?.substring(0, 2).toUpperCase() || "XX",
          flag: "https://via.placeholder.com/24x16/cccccc/ffffff?text=--",
        };

        return {
          code: countryInfo.code,
          name: item.country,
          count_project: item._count,
          color: colors[index % colors.length],
          country_flag: countryInfo.flag,
        };
      });
  }

  private buildValuePillarsData(projectsWithPillars: any[], totalProjects: number): ValuePillarDto[] {
    // Count projects by pillars (pillars is an array field)
    const pillarCounts = new Map();

    projectsWithPillars.forEach((project) => {
      if (project.pillars && Array.isArray(project.pillars)) {
        project.pillars.forEach((pillar: string) => {
          pillarCounts.set(pillar, (pillarCounts.get(pillar) || 0) + 1);
        });
      }
    });

    // Default pillars with colors
    const defaultPillars = [
      { name: "Environmental Performance", color: "#90EE90" },
      { name: "Operating Performance", color: "#87CEEB" },
      { name: "Safety Performance", color: "#F0A0A0" },
    ];

    return defaultPillars.map((pillar) => {
      const count = pillarCounts.get(pillar.name) || 0;
      const percentage = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;

      return {
        name: pillar.name,
        count,
        color: pillar.color,
        percentage,
      };
    });
  }
}
