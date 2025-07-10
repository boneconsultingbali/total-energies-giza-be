import { PrismaClient } from "@prisma/client";

export async function seedPermissions(prisma: PrismaClient) {
  console.log("🔐 Seeding permissions...");

  const permissions = [
    // User management permissions
    { name: "user:create", description: "Create users" },
    { name: "user:read", description: "Read users" },
    { name: "user:update", description: "Update users" },
    { name: "user:delete", description: "Delete users" },
    { name: "user:anonymize", description: "Anonymize users" },
    { name: "user:activate", description: "Activate/deactivate users" },
    { name: "user:unlock", description: "Unlock user accounts" },
    { name: "user:view-logs", description: "View user login logs" },

    // Role and permission management
    { name: "role:create", description: "Create roles" },
    { name: "role:read", description: "Read roles" },
    { name: "role:update", description: "Update roles" },
    { name: "role:delete", description: "Delete roles" },
    { name: "permission:create", description: "Create permissions" },
    { name: "permission:read", description: "Read permissions" },
    { name: "permission:update", description: "Update permissions" },
    { name: "permission:delete", description: "Delete permissions" },
    { name: "permission:read", description: "Read permissions" },
    { name: "permission:assign", description: "Assign permissions to roles" },

    // System administration
    { name: "system:admin", description: "Full system administration" },
    { name: "system:logs", description: "View system logs" },
    { name: "system:monitoring", description: "Access monitoring tools" },

    // Tenant management
    { name: "tenant:create", description: "Create tenants" },
    { name: "tenant:read", description: "Read tenants" },
    { name: "tenant:update", description: "Update tenants" },
    { name: "tenant:delete", description: "Delete tenants" },

    // Project management
    { name: "project:create", description: "Create projects" },
    { name: "project:read", description: "Read projects" },
    { name: "project:update", description: "Update projects" },
    { name: "project:delete", description: "Delete projects" },

    // Document management
    { name: "document:create", description: "Create documents" },
    { name: "document:read", description: "Read documents" },
    { name: "document:update", description: "Update documents" },
    { name: "document:delete", description: "Delete documents" },

    // Performance indicator management
    { name: "indicator:create", description: "Create performance indicators" },
    { name: "indicator:read", description: "Read performance indicators" },
    { name: "indicator:update", description: "Update performance indicators" },
    { name: "indicator:delete", description: "Delete performance indicators" },

    // Profile management
    { name: "profile:read", description: "Read own profile" },
    { name: "profile:update", description: "Update own profile" },
  ];

  for (const permission of permissions) {
    await prisma.tbm_permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }

  console.log(`✅ Created ${permissions.length} permissions`);
  return permissions;
}
