import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreatePerformanceIndicatorDto } from "./dto/create-performance-indicator.dto";
import { UpdatePerformanceIndicatorDto } from "./dto/update-performance-indicator.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";

interface IndicatorSearchQuery extends PaginationDto {
  parent_id?: string;
  has_parent?: string;
  q?: string;
  pillars?: string;
}

@Injectable()
export class PerformanceIndicatorService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePerformanceIndicatorDto) {
    // Check if indicator with same name already exists
    const existingIndicator =
      await this.prisma.tbm_performance_indicator.findUnique({
        where: { name: createDto.name },
      });

    if (existingIndicator) {
      throw new ConflictException(
        "Performance indicator with this name already exists"
      );
    }

    // Validate parent exists if provided
    if (createDto.parent_id) {
      const parent = await this.prisma.tbm_performance_indicator.findUnique({
        where: { id: createDto.parent_id },
      });
      if (!parent) {
        throw new BadRequestException("Parent indicator not found");
      }
    }

    const indicator = await this.prisma.tbm_performance_indicator.create({
      data: createDto,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: {
            children: true,
            projects: true,
          },
        },
      },
    });

    return indicator;
  }

  async findAll(query: IndicatorSearchQuery): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy,
      sortOrder = "desc",
      parent_id,
      has_parent,
      q,
      pillars,
    } = query;
    // Convert to numbers to avoid Prisma error
    const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    // Build search conditions
    const searchConditions = [];

    // Handle general search
    const searchTerm = q || search;
    if (searchTerm) {
      searchConditions.push({
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
          { parent: { name: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }

    // Handle parent filter
    if (parent_id) {
      searchConditions.push({ parent_id });
    }

    // Handle has_parent filter
    if (has_parent !== undefined) {
      if (has_parent === "true") {
        searchConditions.push({ parent_id: { not: null } });
      } else if (has_parent === "false") {
        searchConditions.push({ parent_id: null });
      }
    }

    if (pillars) {
      const pillarIds = pillars.split(",").map((id) => id.trim());
      searchConditions.push({
        pillar: { in: pillarIds },
      });
    }

    const where = searchConditions.length > 0 ? { AND: searchConditions } : {};
    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : { created_at: sortOrder };

    const [indicators, total] = await Promise.all([
      this.prisma.tbm_performance_indicator.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          children: {
            select: {
              id: true,
              name: true,
              description: true,
              unit: true,
              min_score: true,
              max_score: true,
              is_grey: true,
            },
          },
          _count: {
            select: {
              children: true,
              projects: true,
            },
          },
        },
      }),
      this.prisma.tbm_performance_indicator.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: indicators,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };
  }

  async findOne(id: string) {
    const indicator = await this.prisma.tbm_performance_indicator.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
            _count: {
              select: {
                children: true,
                projects: true,
              },
            },
          },
        },
        projects: {
          select: {
            id: true,
            score: true,
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            children: true,
            projects: true,
          },
        },
      },
    });

    if (!indicator) {
      throw new NotFoundException("Performance indicator not found");
    }

    return indicator;
  }

  async update(id: string, updateDto: UpdatePerformanceIndicatorDto) {
    const indicator = await this.findOne(id);

    // Check if new name conflicts with existing indicators (excluding current one)
    if (updateDto.name && updateDto.name !== indicator.name) {
      const existingIndicator =
        await this.prisma.tbm_performance_indicator.findUnique({
          where: { name: updateDto.name },
        });
      if (existingIndicator) {
        throw new ConflictException(
          "Performance indicator with this name already exists"
        );
      }
    }

    // Validate parent exists if provided
    if (updateDto.parent_id) {
      // Prevent circular reference
      if (updateDto.parent_id === id) {
        throw new BadRequestException("Indicator cannot be its own parent");
      }

      const parent = await this.prisma.tbm_performance_indicator.findUnique({
        where: { id: updateDto.parent_id },
      });
      if (!parent) {
        throw new BadRequestException("Parent indicator not found");
      }

      // Check if the new parent would create a circular reference
      await this.validateNoCircularReference(id, updateDto.parent_id);
    }

    const updatedIndicator = await this.prisma.tbm_performance_indicator.update(
      {
        where: { id },
        data: updateDto,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          children: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: {
              children: true,
              projects: true,
            },
          },
        },
      }
    );

    return updatedIndicator;
  }

  async remove(id: string) {
    const indicator = await this.findOne(id);

    // Check if indicator has children
    if (indicator._count.children > 0) {
      throw new BadRequestException(
        "Cannot delete indicator that has child indicators. Please delete or reassign child indicators first."
      );
    }

    // Check if indicator is used in projects
    if (indicator._count.projects > 0) {
      throw new BadRequestException(
        "Cannot delete indicator that is used in projects. Please remove from projects first."
      );
    }

    await this.prisma.tbm_performance_indicator.delete({
      where: { id },
    });

    return { message: "Performance indicator deleted successfully" };
  }

  async getHierarchy() {
    // Get all root indicators (no parent) with their full hierarchy
    const rootIndicators = await this.prisma.tbm_performance_indicator.findMany(
      {
        where: { parent_id: null },
        include: {
          children: {
            include: {
              children: {
                include: {
                  children: true, // Support up to 3 levels deep
                },
              },
              _count: {
                select: {
                  children: true,
                  projects: true,
                },
              },
            },
          },
          _count: {
            select: {
              children: true,
              projects: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }
    );

    return rootIndicators;
  }

  async getAvailableParents(excludeId?: string) {
    const where = excludeId ? { id: { not: excludeId } } : {};

    return this.prisma.tbm_performance_indicator.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        parent_id: true,
        parent: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async getStatistics() {
    const [total, rootCount, withChildren, withProjects] = await Promise.all([
      this.prisma.tbm_performance_indicator.count(),
      this.prisma.tbm_performance_indicator.count({
        where: { parent_id: null },
      }),
      this.prisma.tbm_performance_indicator.count({
        where: {
          children: {
            some: {},
          },
        },
      }),
      this.prisma.tbm_performance_indicator.count({
        where: {
          projects: {
            some: {},
          },
        },
      }),
    ]);

    return {
      total,
      root_indicators: rootCount,
      indicators_with_children: withChildren,
      indicators_in_use: withProjects,
      child_indicators: total - rootCount,
    };
  }

  private async validateNoCircularReference(
    indicatorId: string,
    newParentId: string
  ) {
    // Get all descendants of the current indicator
    const descendants = await this.getDescendants(indicatorId);
    const descendantIds = descendants.map((d) => d.id);

    // Check if the new parent is among the descendants
    if (descendantIds.includes(newParentId)) {
      throw new BadRequestException(
        "Cannot set parent: this would create a circular reference"
      );
    }
  }

  private async getDescendants(indicatorId: string): Promise<any[]> {
    const children = await this.prisma.tbm_performance_indicator.findMany({
      where: { parent_id: indicatorId },
      select: { id: true },
    });

    let descendants = [...children];

    for (const child of children) {
      const childDescendants = await this.getDescendants(child.id);
      descendants = [...descendants, ...childDescendants];
    }

    return descendants;
  }
}
