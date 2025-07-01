import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

interface DocumentSearchQuery extends PaginationDto {
  tenant_id?: string;
  project_id?: string;
  q?: string;
}

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateDocumentDto, userId: string, userRole: string) {
    // Validate tenant exists if provided
    if (createDto.tenant_id) {
      const tenant = await this.prisma.tbm_tenant.findUnique({
        where: { id: createDto.tenant_id },
      });
      if (!tenant) {
        throw new BadRequestException('Tenant not found');
      }

      // Check access for regular users
      if (userRole === 'user') {
        const hasAccess = await this.checkUserTenantAccess(userId, createDto.tenant_id);
        if (!hasAccess) {
          throw new ForbiddenException('Access denied to this tenant');
        }
      }
    }

    // Validate project exists if provided
    if (createDto.project_id) {
      const project = await this.prisma.tbm_project.findUnique({
        where: { id: createDto.project_id },
        include: { tenant: true },
      });
      if (!project) {
        throw new BadRequestException('Project not found');
      }

      // Check access for regular users
      if (userRole === 'user') {
        const hasAccess = project.owner_id === userId || 
          (project.tenant_id && await this.checkUserTenantAccess(userId, project.tenant_id));
        if (!hasAccess) {
          throw new ForbiddenException('Access denied to this project');
        }
      }
    }

    const document = await this.prisma.tbm_document.create({
      data: createDto,
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return document;
  }

  async findAll(query: DocumentSearchQuery, userId: string, userRole: string): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder = 'desc', tenant_id, project_id, q } = query;
    const skip = (page - 1) * limit;

    // Build search conditions
    const searchConditions = [];
    
    // Handle general search
    const searchTerm = q || search;
    if (searchTerm) {
      searchConditions.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { content: { contains: searchTerm, mode: 'insensitive' } },
          { tenant: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { project: { name: { contains: searchTerm, mode: 'insensitive' } } },
        ],
      });
    }

    // Handle tenant filter
    if (tenant_id) {
      searchConditions.push({ tenant_id });
    }

    // Handle project filter
    if (project_id) {
      searchConditions.push({ project_id });
    }

    // Role-based access control
    if (userRole === 'user') {
      searchConditions.push({
        OR: [
          { project: { owner_id: userId } },
          { tenant: { employees: { some: { id: userId } } } },
          { project: { tenant: { employees: { some: { id: userId } } } } },
        ],
      });
    }

    const where = searchConditions.length > 0 ? { AND: searchConditions } : {};
    const orderBy = sortBy ? { [sortBy]: sortOrder } : { created_at: sortOrder };

    const [documents, total] = await Promise.all([
      this.prisma.tbm_document.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tenant: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.tbm_document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: documents,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const document = await this.prisma.tbm_document.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
            country: true,
            address: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            owner_id: true,
            tenant_id: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Role-based access control
    if (userRole === 'user') {
      let hasAccess = false;
      
      if (document.project) {
        hasAccess = document.project.owner_id === userId || 
          (document.project.tenant_id && await this.checkUserTenantAccess(userId, document.project.tenant_id));
      } else if (document.tenant_id) {
        hasAccess = await this.checkUserTenantAccess(userId, document.tenant_id);
      }
      
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this document');
      }
    }

    return document;
  }

  async update(id: string, updateDto: UpdateDocumentDto, userId: string, userRole: string) {
    const document = await this.findOne(id, userId, userRole);

    // Validate tenant exists if provided
    if (updateDto.tenant_id) {
      const tenant = await this.prisma.tbm_tenant.findUnique({
        where: { id: updateDto.tenant_id },
      });
      if (!tenant) {
        throw new BadRequestException('Tenant not found');
      }

      // Check access for regular users
      if (userRole === 'user') {
        const hasAccess = await this.checkUserTenantAccess(userId, updateDto.tenant_id);
        if (!hasAccess) {
          throw new ForbiddenException('Access denied to this tenant');
        }
      }
    }

    // Validate project exists if provided
    if (updateDto.project_id) {
      const project = await this.prisma.tbm_project.findUnique({
        where: { id: updateDto.project_id },
      });
      if (!project) {
        throw new BadRequestException('Project not found');
      }

      // Check access for regular users
      if (userRole === 'user') {
        const hasAccess = project.owner_id === userId || 
          (project.tenant_id && await this.checkUserTenantAccess(userId, project.tenant_id));
        if (!hasAccess) {
          throw new ForbiddenException('Access denied to this project');
        }
      }
    }

    const updatedDocument = await this.prisma.tbm_document.update({
      where: { id },
      data: updateDto,
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return updatedDocument;
  }

  async remove(id: string, userId: string, userRole: string) {
    await this.findOne(id, userId, userRole);

    await this.prisma.tbm_document.delete({
      where: { id },
    });

    return { message: 'Document deleted successfully' };
  }

  private async checkUserTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    const user = await this.prisma.tbm_user.findUnique({
      where: { id: userId },
      select: { tenant_id: true },
    });
    
    return user?.tenant_id === tenantId;
  }
}