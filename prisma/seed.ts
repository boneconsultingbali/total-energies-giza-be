import { PrismaClient } from "@prisma/client";
import { seedPermissions } from "./seeders/permissions.seeder";
import { seedRoles } from "./seeders/roles.seeder";
import { seedUsers } from "./seeders/users.seeder";
import { seedPerformanceIndicators } from "./seeders/performance-indicators.seeder";
import { seedTenants } from "./seeders/tenants.seeder";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");
  console.log("=====================================");

  try {
    // Seed in order of dependencies
    await seedPermissions(prisma);
    console.log("");

    await seedRoles(prisma);
    console.log("");

    await seedUsers(prisma);
    console.log("");

    await seedPerformanceIndicators(prisma);
    console.log("");

    await seedTenants(prisma);
    console.log("");

    console.log("=====================================");
    console.log("🎉 Database seeding completed successfully!");
    console.log("=====================================");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
