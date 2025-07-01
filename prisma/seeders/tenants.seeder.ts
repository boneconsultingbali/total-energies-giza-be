import { PrismaClient } from '@prisma/client';

export async function seedTenants(prisma: PrismaClient) {
  console.log('🏢 Seeding tenants...');

  // Get admin user to assign as leader
  const adminUser = await prisma.tbm_user.findUnique({
    where: { email: 'admin@example.com' },
  });

  const managerUser = await prisma.tbm_user.findUnique({
    where: { email: 'manager@example.com' },
  });

  const tenants = [
    {
      code: 'ACME001',
      name: 'ACME Corporation',
      country: 'United States',
      address: '123 Business St, New York, NY 10001',
      leader_id: adminUser?.id,
    },
    {
      code: 'TECH002',
      name: 'Tech Solutions Inc',
      country: 'Canada',
      address: '456 Innovation Ave, Toronto, ON M5V 3A8',
      leader_id: managerUser?.id,
    },
    {
      code: 'ENERGY003',
      name: 'Green Energy Ltd',
      country: 'United Kingdom',
      address: '789 Renewable Way, London, UK SW1A 1AA',
    },
    {
      code: 'MANU004',
      name: 'Manufacturing Pro',
      country: 'Germany',
      address: '321 Industrial Blvd, Berlin, Germany 10115',
    },
  ];

  for (const tenantData of tenants) {
    const tenant = await prisma.tbm_tenant.upsert({
      where: { code: tenantData.code },
      update: {},
      create: tenantData,
    });
    console.log(`✅ Created tenant: ${tenantData.name} (${tenantData.code})`);
  }

  console.log(`✅ Created ${tenants.length} tenants`);
}