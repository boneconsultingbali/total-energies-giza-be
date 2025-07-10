import { PrismaService } from "@/database/prisma/prisma.service";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { AssignPermissionDto } from "./dto/assign-permission.dto";

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async fetchRoles() {
    return this.prisma.tbm_role.findMany({
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async createRole(createRoleDto: CreateRoleDto) {
    const role = await this.prisma.tbm_role.findFirst({
      where: {
        name: createRoleDto.name,
      },
    });

    if (role) throw new ConflictException("Role already exists");

    return this.prisma.tbm_role.create({
      data: createRoleDto,
    });
  }

  async updateRole(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.prisma.tbm_role.findUnique({
      where: {
        id,
      },
    });

    if (!role) throw new NotFoundException("Role not found");

    if (role.name !== updateRoleDto.name) {
      const existingRole = await this.prisma.tbm_role.findFirst({
        where: {
          name: updateRoleDto.name,
        },
      });
      if (existingRole) {
        throw new ConflictException("Role with this name already exists");
      }
    }

    return this.prisma.tbm_role.update({
      where: {
        id,
      },
      data: updateRoleDto,
    });
  }

  //   Permissions
  async fetchPermissions() {
    return this.prisma.tbm_permission.findMany({
      orderBy: {
        name: "asc",
      },
    });
  }

  async createPermission(createPermissionDto: CreatePermissionDto) {
    const permission = await this.prisma.tbm_permission.findFirst({
      where: {
        name: createPermissionDto.name,
      },
    });
    if (permission) throw new ConflictException("Permission already exists");

    return this.prisma.tbm_permission.create({
      data: createPermissionDto,
    });
  }

  async updatePermission(id: string, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.prisma.tbm_permission.findUnique({
      where: {
        id,
      },
    });

    if (!permission) throw new NotFoundException("Permission not found");

    if (permission.name !== updatePermissionDto.name) {
      const existingPermission = await this.prisma.tbm_permission.findFirst({
        where: {
          name: updatePermissionDto.name,
        },
      });
      if (existingPermission) {
        throw new ConflictException("Permission with this name already exists");
      }
    }

    return this.prisma.tbm_permission.update({
      where: {
        id,
      },
      data: updatePermissionDto,
    });
  }

  async assignPermissions({
    role_id,
    assignPermissionDto,
  }: {
    role_id: string;
    assignPermissionDto: AssignPermissionDto;
  }) {
    const role = await this.prisma.tbm_role.findUnique({
      where: { id: role_id },
    });

    if (!role) throw new NotFoundException("Role not found");

    const existingPermissions = await this.prisma.tbs_role_permission.findMany({
      where: { role_id: role_id },
      select: { permission_id: true },
    });

    const existingPermissionIds = existingPermissions.map(
      (p) => p.permission_id
    );

    const newPermissions = assignPermissionDto.permission_ids.filter(
      (id) => !existingPermissionIds.includes(id)
    );

    if (newPermissions.length === 0) {
      return { message: "No new permissions to assign" };
    }

    const rolePermissions = newPermissions.map((permissionId) => ({
      role_id: role_id,
      permission_id: permissionId,
    }));

    return this.prisma.tbs_role_permission.createMany({
      data: rolePermissions,
    });
  }
}
