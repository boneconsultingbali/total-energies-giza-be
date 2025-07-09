import { PrismaService } from "@/database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";

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

  //   Permissions

  async fetchPermissions() {
    return this.prisma.tbm_permission.findMany({
      orderBy: {
        name: "asc",
      },
    });
  }
}
