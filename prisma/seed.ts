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
  console.log("🌱 Seeding accounts and performers according to the new architecture...");

  // 1. Seed ADMIN accounts (Independent accounts, Name, Email, WhatsApp, Password, No performers)
  const adminPassword = await hashPassword("admin123");
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, email: "admin@hpc.com" },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        role: Role.ADMIN,
        name: "Head of Operations / Chief Admin",
        email: "admin@hpc.com",
        whatsapp: "+8801700000001",
        password: adminPassword,
      },
    });
    console.log("✅ Admin account created: admin@hpc.com");
  } else {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        name: "Head of Operations / Chief Admin",
        whatsapp: "+8801700000001",
        password: adminPassword,
      },
    });
    console.log("✅ Admin account updated: admin@hpc.com");
  }

  // 2. Seed DOCTOR accounts (Multiple independent accounts, Name, Email, WhatsApp, Password, No performers)
  const doctorPassword = await hashPassword("doctor123");
  const doctorsData = [
    {
      name: "Dr. Farhan Ahmed, PT, DPT",
      email: "dr.farhan@hpc.com",
      whatsapp: "+8801700000002",
      password: doctorPassword,
    },
    {
      name: "Dr. Nusrat Jahan, Specialist PT",
      email: "dr.nusrat@hpc.com",
      whatsapp: "+8801700000003",
      password: doctorPassword,
    },
  ];

  for (const doc of doctorsData) {
    const existingDoc = await prisma.user.findFirst({
      where: { role: Role.DOCTOR, email: doc.email },
    });
    if (!existingDoc) {
      await prisma.user.create({
        data: {
          role: Role.DOCTOR,
          name: doc.name,
          email: doc.email,
          whatsapp: doc.whatsapp,
          password: doc.password,
        },
      });
      console.log(`✅ Doctor account created: ${doc.name} (${doc.email})`);
    } else {
      await prisma.user.update({
        where: { id: existingDoc.id },
        data: {
          name: doc.name,
          whatsapp: doc.whatsapp,
          password: doc.password,
        },
      });
      console.log(`✅ Doctor account updated: ${doc.name} (${doc.email})`);
    }
  }

  // 3. Seed RECEPTIONIST (Single shared desk account, multiple performers with 4-digit PIN)
  const receptionPassword = await hashPassword("reception123");
  let receptionDesk = await prisma.user.findFirst({
    where: { role: Role.RECEPTIONIST },
  });
  if (!receptionDesk) {
    receptionDesk = await prisma.user.create({
      data: {
        role: Role.RECEPTIONIST,
        password: receptionPassword,
        name: null,
        email: null,
        whatsapp: null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: receptionDesk.id },
      data: { password: receptionPassword },
    });
  }
  console.log("✅ Receptionist desk account verified.");

  const receptionPerformers = [
    {
      name: "Ayesha Siddiqua",
      email: "ayesha@hpc.com",
      whatsapp: "+8801811111101",
      phone: "+8801811111101",
      pin: "1234",
    },
    {
      name: "Tanvir Hasan",
      email: "tanvir@hpc.com",
      whatsapp: "+8801811111102",
      phone: "+8801811111102",
      pin: "5678",
    },
  ];

  for (const perf of receptionPerformers) {
    const existingPerf = await prisma.performer.findFirst({
      where: { userId: receptionDesk.id, whatsapp: perf.whatsapp },
    });
    if (!existingPerf) {
      await prisma.performer.create({
        data: {
          userId: receptionDesk.id,
          name: perf.name,
          email: perf.email,
          whatsapp: perf.whatsapp,
          phone: perf.phone,
          pin: perf.pin,
        },
      });
      console.log(`  ➕ Receptionist performer added: ${perf.name} (PIN: ${perf.pin})`);
    } else {
      await prisma.performer.update({
        where: { id: existingPerf.id },
        data: {
          name: perf.name,
          email: perf.email,
          phone: perf.phone,
          pin: perf.pin,
        },
      });
    }
  }

  // 4. Seed HANDLER (Single shared desk account, multiple performers with 4-digit PIN)
  const handlerPassword = await hashPassword("handler123");
  let handlerDesk = await prisma.user.findFirst({
    where: { role: Role.HANDLER },
  });
  if (!handlerDesk) {
    handlerDesk = await prisma.user.create({
      data: {
        role: Role.HANDLER,
        password: handlerPassword,
        name: null,
        email: null,
        whatsapp: null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: handlerDesk.id },
      data: { password: handlerPassword },
    });
  }
  console.log("✅ Handler desk account verified.");

  const handlerPerformers = [
    {
      name: "Sabbir Rahman (PT)",
      email: "sabbir.pt@hpc.com",
      whatsapp: "+8801922222201",
      phone: "+8801922222201",
      pin: "1122",
    },
    {
      name: "Mahmuda Khatun (PT)",
      email: "mahmuda.pt@hpc.com",
      whatsapp: "+8801922222202",
      phone: "+8801922222202",
      pin: "3344",
    },
  ];

  for (const perf of handlerPerformers) {
    const existingPerf = await prisma.performer.findFirst({
      where: { userId: handlerDesk.id, whatsapp: perf.whatsapp },
    });
    if (!existingPerf) {
      await prisma.performer.create({
        data: {
          userId: handlerDesk.id,
          name: perf.name,
          email: perf.email,
          whatsapp: perf.whatsapp,
          phone: perf.phone,
          pin: perf.pin,
        },
      });
      console.log(`  ➕ Handler performer added: ${perf.name} (PIN: ${perf.pin})`);
    } else {
      await prisma.performer.update({
        where: { id: existingPerf.id },
        data: {
          name: perf.name,
          email: perf.email,
          phone: perf.phone,
          pin: perf.pin,
        },
      });
    }
  }

  // 5. Seed CASHIER (Single shared desk account, multiple performers with 4-digit PIN)
  const cashierPassword = await hashPassword("cashier123");
  let cashierDesk = await prisma.user.findFirst({
    where: { role: Role.CASHIER },
  });
  if (!cashierDesk) {
    cashierDesk = await prisma.user.create({
      data: {
        role: Role.CASHIER,
        password: cashierPassword,
        name: null,
        email: null,
        whatsapp: null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: cashierDesk.id },
      data: { password: cashierPassword },
    });
  }
  console.log("✅ Cashier desk account verified.");

  const cashierPerformers = [
    {
      name: "Kamrul Islam",
      email: "kamrul@hpc.com",
      whatsapp: "+8801633333301",
      phone: "+8801633333301",
      pin: "9988",
    },
    {
      name: "Shamima Akhter",
      email: "shamima@hpc.com",
      whatsapp: "+8801633333302",
      phone: "+8801633333302",
      pin: "7766",
    },
  ];

  for (const perf of cashierPerformers) {
    const existingPerf = await prisma.performer.findFirst({
      where: { userId: cashierDesk.id, whatsapp: perf.whatsapp },
    });
    if (!existingPerf) {
      await prisma.performer.create({
        data: {
          userId: cashierDesk.id,
          name: perf.name,
          email: perf.email,
          whatsapp: perf.whatsapp,
          phone: perf.phone,
          pin: perf.pin,
        },
      });
      console.log(`  ➕ Cashier performer added: ${perf.name} (PIN: ${perf.pin})`);
    } else {
      await prisma.performer.update({
        where: { id: existingPerf.id },
        data: {
          name: perf.name,
          email: perf.email,
          phone: perf.phone,
          pin: perf.pin,
        },
      });
    }
  }

  // Clean up any legacy performers that were under ADMIN or DOCTOR users
  const adminUsers = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } });
  const doctorUsers = await prisma.user.findMany({ where: { role: Role.DOCTOR }, select: { id: true } });
  const noPerformerUserIds = [...adminUsers, ...doctorUsers].map(u => u.id);
  if (noPerformerUserIds.length > 0) {
    await prisma.performer.deleteMany({
      where: { userId: { in: noPerformerUserIds } },
    });
  }

  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
