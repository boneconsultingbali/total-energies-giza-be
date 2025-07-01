import { PrismaClient } from '@prisma/client';

export async function seedRoles(prisma: PrismaClient) {
  console.log('👥 Seeding roles...');

  // Create roles
  const superadminRole = await prisma.tbm_role.upsert({
    where: { name: 'superadmin' },
    update: {},
    create: { name: 'superadmin' },
  });

  const adminRole = await prisma.tbm_role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });

  const userRole = await prisma.tbm_role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user' },
  });

  console.log('✅ Created roles: superadmin, admin, user');

  // Assign ALL permissions to superadmin
  const allPermissions = await prisma.tbm_permission.findMany();
  for (const permission of allPermissions) {
    await prisma.tbs_role_permission.upsert({
      where: {
        role_id_permission_id: {
          role_id: superadminRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: superadminRole.id,
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
          'user:create',
          'user:read',
          'user:update',
          'user:delete',
          'user:activate',
          'user:unlock',
          'user:view-logs',
          
          // Role management (read only)
          'role:read',
          'permission:read',
          
          // Tenant management
          'tenant:create',
          'tenant:read',
          'tenant:update',
          'tenant:delete',
          
          // Project management
          'project:create',
          'project:read',
          'project:update',
          'project:delete',
          
          // Document management
          'document:create',
          'document:read',
          'document:update',
          'document:delete',
          
          // Performance indicator management
          'indicator:create',
          'indicator:read',
          'indicator:update',
          'indicator:delete',
          
          // Profile management
          'profile:read',
          'profile:update',
          
          // System monitoring (limited)
          'system:logs',
        ],
      },
    },
  });

  for (const permission of adminPermissions) {
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

  // Assign basic permissions to user role
  const userPermissions = await prisma.tbm_permission.findMany({
    where: {
      name: {
        in: [
          // Basic read permissions
          'user:read', // Can view other users (limited)
          'permission:read',
          
          // Own profile management
          'profile:read',
          'profile:update',
          
          // Project participation
          'project:read',
          
          // Document access
          'document:read',
          
          // Performance indicator read access
          'indicator:read',
        ],
      },
    },
  });

  for (const permission of userPermissions) {
    await prisma.tbs_role_permission.upsert({
      where: {
        role_id_permission_id: {
          role_id: userRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: userRole.id,
        permission_id: permission.id,
      },
    });
  }

  console.log('✅ Assigned permissions to roles');

  return { superadminRole, adminRole, userRole };
}