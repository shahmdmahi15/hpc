import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Role } from "../src/generated/prisma/enums";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./hpc.db",
});
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

const SEED_USERS = [
  {
    role: Role.ADMIN,
    password: "admin123",
  },
  {
    role: Role.DOCTOR,
    password: "doctor123",
  },
  {
    role: Role.RECEPTIONIST,
    password: "reception123",
  },
  {
    role: Role.HANDLER,
    password: "handler123",
  },
  {
    role: Role.CASHIER,
    password: "cashier123",
  },
];

async function main() {
  console.log("🌱 Seeding unique role accounts...");

  for (const account of SEED_USERS) {
    const hashedPassword = await hashPassword(account.password);

    const user = await prisma.user.upsert({
      where: { role: account.role },
      update: {
        password: hashedPassword,
      },
      create: {
        role: account.role,
        password: hashedPassword,
      },
    });

    console.log(`✅ Role [${user.role}] account seeded successfully.`);
  }

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
