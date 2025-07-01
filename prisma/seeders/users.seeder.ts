import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export async function seedUsers(prisma: PrismaClient) {
  console.log("👤 Seeding users...");

  // Create superadmin user
  const superadminPassword = await bcrypt.hash("superadmin123", 10);
  const superadminUser = await prisma.tbm_user.upsert({
    where: { email: "superadmin@example.com" },
    update: {},
    create: {
      email: "superadmin@example.com",
      password: superadminPassword,
      role_name: "superadmin",
      profile: {
        create: {
          first_name: "Super",
          last_name: "Admin",
          phone: "+1-555-0001",
          country: "United States",
          city: "New York",
        },
      },
    },
  });

  console.log(
    "✅ Created superadmin user: superadmin@example.com (password: superadmin123)"
  );

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.tbm_user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: adminPassword,
      role_name: "admin",
      profile: {
        create: {
          first_name: "Admin",
          last_name: "User",
          phone: "+1-555-0002",
          country: "United States",
          city: "Los Angeles",
        },
      },
    },
  });

  console.log("✅ Created admin user: admin@example.com (password: admin123)");

  // Create regular user
  const userPassword = await bcrypt.hash("user123", 10);
  const testUser = await prisma.tbm_user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      password: userPassword,
      role_name: "user",
      profile: {
        create: {
          first_name: "Test",
          last_name: "User",
          phone: "+1-555-0003",
          country: "Canada",
          city: "Toronto",
        },
      },
    },
  });

  console.log("✅ Created test user: user@example.com (password: user123)");

  // Create additional sample users
  const sampleUsers = [
    {
      email: "manager@example.com",
      password: await bcrypt.hash("manager123", 10),
      role_name: "admin",
      profile: {
        first_name: "Project",
        last_name: "Manager",
        phone: "+1-555-0004",
        country: "United Kingdom",
        city: "London",
      },
    },
    {
      email: "analyst@example.com",
      password: await bcrypt.hash("analyst123", 10),
      role_name: "user",
      profile: {
        first_name: "Data",
        last_name: "Analyst",
        phone: "+1-555-0005",
        country: "Germany",
        city: "Berlin",
      },
    },
  ];

  for (const userData of sampleUsers) {
    await prisma.tbm_user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        password: userData.password,
        role_name: userData.role_name,
        profile: {
          create: userData.profile,
        },
      },
    });
    console.log(`✅ Created user: ${userData.email}`);
  }

  return { superadminUser, adminUser, testUser };
}
