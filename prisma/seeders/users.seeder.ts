import { Role } from "../../src/constants/role";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export async function seedUsers(prisma: PrismaClient) {
  console.log("👤 Seeding users...");
  const password = "Pass1234";
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create admin user
  const adminUser = await prisma.tbm_user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: hashedPassword,
      role_name: Role.Admin,
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
    `✅ Created admin user: admin@example.com (password: ${password})`
  );

  // Create standard user
  const standardUser = await prisma.tbm_user.upsert({
    where: { email: "standarduser@example.com" },
    update: {},
    create: {
      email: "standarduser@example.com",
      password: hashedPassword,
      role_name: Role.StandardUser,
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

  console.log(
    `✅ Created standard user: standarduser@example.com (password: ${password})`
  );

  // Create regular user
  const viewerUser = await prisma.tbm_user.upsert({
    where: { email: "viewer@example.com" },
    update: {},
    create: {
      email: "viewer@example.com",
      password: hashedPassword,
      role_name: Role.Viewer,
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

  console.log(
    `✅ Created viewer user: viewer@example.com (password: ${password})`
  );

  return { adminUser, standardUser, viewerUser };
}
