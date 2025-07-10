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

  async fetchRoleById(id: string) {
    const role = await this.prisma.tbm_role.findFirst({
      where: { OR: [{ id }, { name: id }] },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
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
    });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async createRole(createRoleDto: CreateRoleDto) {
    const { permission_ids, ...other } = createRoleDto;

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.tbm_role.findFirst({
        where: { name: other.name },
      });
      if (role) throw new ConflictException("Role already exists");

      const permissions = await tx.tbm_permission.findMany({
        where: { id: { in: permission_ids } },
      });
      if (permissions.length !== permission_ids.length) {
        throw new NotFoundException("Some permissions not found");
      }

      // 1. Create the role
      const createdRole = await tx.tbm_role.create({
        data: other,
      });

      // 2. Create join records in tbs_role_permission
      await tx.tbs_role_permission.createMany({
        data: permission_ids.map((permission_id) => ({
          role_id: createdRole.id,
          permission_id,
        })),
      });

      // 3. Return the created role with permissions
      return tx.tbm_role.findUnique({
        where: { id: createdRole.id },
        include: {
          permissions: true,
        },
      });
    });
  }

  async updateRole(
    id: string,
    updateRoleDto: UpdateRoleDto & { permission_ids?: string[] }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.tbm_role.findUnique({
        where: { id },
        include: { permissions: true },
      });
      if (!role) throw new NotFoundException("Role not found");

      // Check for name conflict
      if (updateRoleDto.name && role.name !== updateRoleDto.name) {
        const existingRole = await tx.tbm_role.findFirst({
          where: { name: updateRoleDto.name },
        });
        if (existingRole) {
          throw new ConflictException("Role with this name already exists");
        }
      }

      // Destructure permission_ids out so it's not passed to Prisma
      const { permission_ids, ...roleData } = updateRoleDto;

      // Update permissions if provided
      if (permission_ids && permission_ids.length > 0) {
        await tx.tbs_role_permission.deleteMany({
          where: { role_id: id },
        });

        const permissions = await tx.tbm_permission.findMany({
          where: { id: { in: permission_ids } },
        });
        if (permissions.length !== permission_ids.length) {
          throw new NotFoundException("Some permissions not found");
        }
        const rolePermissions = permission_ids.map((permissionId) => ({
          role_id: id,
          permission_id: permissionId,
        }));
        await tx.tbs_role_permission.createMany({
          data: rolePermissions,
        });
      }

      return tx.tbm_role.update({
        where: { id },
        data: {
          ...roleData,
        },
      });
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
