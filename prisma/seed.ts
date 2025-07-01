import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './seeders/permissions.seeder';
import { seedRoles } from './seeders/roles.seeder';
import { seedUsers } from './seeders/users.seeder';
import { seedPerformanceIndicators } from './seeders/performance-indicators.seeder';
import { seedTenants } from './seeders/tenants.seeder';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log('=====================================');

  try {
    // Seed in order of dependencies
    await seedPermissions(prisma);
    console.log('');
    
    await seedRoles(prisma);
    console.log('');
    
    await seedUsers(prisma);
    console.log('');
    
    await seedPerformanceIndicators(prisma);
    console.log('');
    
    await seedTenants(prisma);
    console.log('');

    console.log('=====================================');
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📋 Default Users Created:');
    console.log('🔴 Superadmin: superadmin@example.com (password: superadmin123)');
    console.log('🟡 Admin: admin@example.com (password: admin123)');
    console.log('🟢 User: user@example.com (password: user123)');
    console.log('🟡 Manager: manager@example.com (password: manager123)');
    console.log('🟢 Analyst: analyst@example.com (password: analyst123)');
    console.log('');
    console.log('🔐 Role Hierarchy:');
    console.log('• Superadmin: Full system access, can manage roles and permissions');
    console.log('• Admin: User management, tenant/project management, performance indicators');
    console.log('• User: Basic read access, own profile management');
    console.log('');
    console.log('📊 Performance Indicators:');
    console.log('• 8 root categories with hierarchical structure');
    console.log('• Production optimization, Cost vigilance, DE, Operational Cost');
    console.log('• Decreasing Methane Intensity, Operating Performance, More Energy, Growing Cash Flow');
    console.log('');
    console.log('🏢 Sample Tenants:');
    console.log('• ACME Corporation (ACME001)');
    console.log('• Tech Solutions Inc (TECH002)');
    console.log('• Green Energy Ltd (ENERGY003)');
    console.log('• Manufacturing Pro (MANU004)');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });