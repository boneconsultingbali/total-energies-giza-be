import { Role } from "../../src/constants/role";
import { PrismaClient } from "@prisma/client";

export async function seedRoles(prisma: PrismaClient) {
  console.log("👥 Seeding roles...");

  // Create roles
  const [adminRole, standardUserRole, viewerRole] = await Promise.all([
    prisma.tbm_role.upsert({
      where: { name: Role.Admin },
      update: {},
      create: { name: Role.Admin },
    }),
    prisma.tbm_role.upsert({
      where: { name: Role.StandardUser },
      update: {},
      create: { name: Role.StandardUser },
    }),
    prisma.tbm_role.upsert({
      where: { name: Role.Viewer },
      update: {},
      create: { name: Role.Viewer },
    }),
  ]);

  console.log(
    `✅ Created roles: ${adminRole.name}, ${standardUserRole.name}, ${viewerRole.name}`
  );

  // Assign ALL permissions to Admin role
  const allPermissions = await prisma.tbm_permission.findMany();
  for (const permission of allPermissions) {
    await prisma.tbs_role_permission.upsert({
      where: {
        role_id_permission_id: {
          role_id: adminRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: adminRole.id,
        permission_id: permission.id,
      },
    });
  }

  // Assign specific permissions to admin role
  const adminPermissions = await prisma.tbm_permission.findMany({
    where: {
      name: {
        in: [
          // User management (except system admin functions)
          "user:create",
          "user:read",
          "user:update",
          "user:delete",
          "user:activate",
          "user:unlock",
          "user:view-logs",

          // Role management (read only)
          "role:read",
          "permission:read",

          // Tenant management
          "tenant:create",
          "tenant:read",
          "tenant:update",
          "tenant:delete",

          // Project management
          "project:create",
          "project:read",
          "project:update",
          "project:delete",

          // Document management
          "document:create",
          "document:read",
          "document:update",
          "document:delete",

          // Performance indicator management
          "indicator:create",
          "indicator:read",
          "indicator:update",
          "indicator:delete",

          // Profile management
          "profile:read",
          "profile:update",

          // System monitoring (limited)
          "system:logs",
        ],
      },
    },
  });

  for (const permission of adminPermissions) {
    await prisma.tbs_role_permission.upsert({
      where: {
        role_id_permission_id: {
          role_id: standardUserRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: standardUserRole.id,
        permission_id: permission.id,
      },
    });
  }

  // Assign basic permissions to user role
  const viewerPermissions = await prisma.tbm_permission.findMany({
    where: {
      name: {
        in: [
          // Basic read permissions
          "user:read", // Can view other users (limited)
          "permission:read",

          // Own profile management
          "profile:read",
          "profile:update",

          // Project participation
          "project:read",

          // Document access
          "document:read",

          // Performance indicator read access
          "indicator:read",
        ],
      },
    },
  });

  for (const permission of viewerPermissions) {
    await prisma.tbs_role_permission.upsert({
      where: {
        role_id_permission_id: {
          role_id: viewerRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: viewerRole.id,
        permission_id: permission.id,
      },
    });
  }

  console.log("✅ Assigned permissions to roles");

  return { adminRole, standardUserRole, viewerRole };
}
