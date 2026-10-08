import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  Role,
  RoomAccessType,
  RoomGender,
  RoomStatus,
  SlotStatus,
  QueueType,
  ClinicalOptionCategory,
} from "../src/generated/prisma/enums";

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

export async function main() {
  console.log("========================================================");
  console.log("🌱 HPC Clinic Database Seeding & Initialization");
  console.log("========================================================");

  // 1. Clean existing records if any
  console.log("🧹 Clearing all existing records...");
  await prisma.auditLog.deleteMany();
  await prisma.treatmentPlan.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.performer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.therapySlot.deleteMany();
  await prisma.room.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.clinicalOption.deleteMany();
  console.log("✅ Database tables cleared.");

  // ----------------------------------------------------
  // 2. Seed Users & Desk Performers
  // ----------------------------------------------------
  console.log("\n👤 Seeding core user accounts & performers...");

  // ADMIN
  const adminPassword = await hashPassword("admin123");
  const adminUser = await prisma.user.create({
    data: {
      role: Role.ADMIN,
      name: "Admin",
      email: "admin@hpc.com",
      whatsapp: "+8801700000000",
      password: adminPassword,
    },
  });
  console.log(`✅ ADMIN: ${adminUser.name} (${adminUser.email})`);

  // DOCTOR
  const doctorPassword = await hashPassword("doctor123");
  const doctorUser = await prisma.user.create({
    data: {
      role: Role.DOCTOR,
      name: "Doctor",
      email: "doctor@hpc.com",
      whatsapp: "+8801700000000",
      password: doctorPassword,
    },
  });
  console.log(`✅ DOCTOR: ${doctorUser.name} (${doctorUser.email})`);

  // RECEPTIONIST Desk + Performer
  const receptionistPassword = await hashPassword("receptionist123");
  const receptionistDesk = await prisma.user.create({
    data: {
      role: Role.RECEPTIONIST,
      name: "Receptionist Desk",
      email: "receptionist.desk@hpc.com",
      whatsapp: "+8801700000000",
      password: receptionistPassword,
    },
  });
  const receptionistPerformer = await prisma.performer.create({
    data: {
      userId: receptionistDesk.id,
      name: "Receptionist",
      email: "receptionist@hpc.com",
      whatsapp: "+8801700000000",
      phone: "+8801700000000",
      pin: "1234",
    },
  });
  console.log(`✅ RECEPTIONIST: Desk created, Performer '${receptionistPerformer.name}' (PIN: 1234)`);

  // HANDLER Desk + Performer
  const handlerPassword = await hashPassword("handler123");
  const handlerDesk = await prisma.user.create({
    data: {
      role: Role.HANDLER,
      name: "Handler Desk",
      email: "handler.desk@hpc.com",
      whatsapp: "+8801700000000",
      password: handlerPassword,
    },
  });
  const handlerPerformer = await prisma.performer.create({
    data: {
      userId: handlerDesk.id,
      name: "Handler",
      email: "handler@hpc.com",
      whatsapp: "+8801700000000",
      phone: "+8801700000000",
      pin: "1234",
    },
  });
  console.log(`✅ HANDLER: Desk created, Performer '${handlerPerformer.name}' (PIN: 1234)`);

  // CASHIER Desk + Performer
  const cashierPassword = await hashPassword("cashier123");
  const cashierDesk = await prisma.user.create({
    data: {
      role: Role.CASHIER,
      name: "Cashier Desk",
      email: "cashier.desk@hpc.com",
      whatsapp: "+8801700000000",
      password: cashierPassword,
    },
  });
  const cashierPerformer = await prisma.performer.create({
    data: {
      userId: cashierDesk.id,
      name: "Cashier",
      email: "cashier@hpc.com",
      whatsapp: "+8801700000000",
      phone: "+8801700000000",
      pin: "1234",
    },
  });
  console.log(`✅ CASHIER: Desk created, Performer '${cashierPerformer.name}' (PIN: 1234)`);

  // ----------------------------------------------------
  // 3. Seed Queues
  // ----------------------------------------------------
  console.log("\n📋 Seeding central clinic queues...");
  await prisma.queue.createMany({
    data: [
      {
        name: "Therapy Queue",
        type: QueueType.THERAPY,
        description: "Physical therapy and rehabilitation queue",
        isActive: true,
      },
      {
        name: "Consultation Queue",
        type: QueueType.CONSULTATION,
        description: "Doctor consultation and assessment queue",
        isActive: true,
      },
    ],
  });
  console.log("✅ Queues: Therapy & Consultation created.");

  // ----------------------------------------------------
  // 4. Seed Chambers & Rooms (Preset Rooms 200 - 215)
  // ----------------------------------------------------
  console.log("\n🏥 Seeding clinic chambers and rooms (Preset Rooms 200 - 215)...");
  const defaultRoomsData = [
    { number: "200", purpose: "Waiting Room", accessType: RoomAccessType.PUBLIC, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "201", purpose: "Cashier Register", accessType: RoomAccessType.CASHIER, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "202", purpose: "Private Room", accessType: RoomAccessType.PRIVATE, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "203", purpose: "Private Room", accessType: RoomAccessType.PRIVATE, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "204", purpose: "Kitchen", accessType: RoomAccessType.STAFF, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "205", purpose: "Doctor Consultation", accessType: RoomAccessType.DOCTOR, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "206", purpose: "Equipment Room", accessType: RoomAccessType.STAFF, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "207", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "208", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "209", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "210", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "211", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "212", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "213", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "214", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
    { number: "215", purpose: "Therapy Room", accessType: RoomAccessType.THERAPY, gender: RoomGender.COMMON, status: RoomStatus.AVAILABLE },
  ];

  const createdRooms: Record<string, string> = {};
  for (const r of defaultRoomsData) {
    const created = await prisma.room.create({
      data: r,
    });
    createdRooms[r.number] = created.id;
  }
  console.log(`✅ Seeded ${defaultRoomsData.length} clinic rooms (Rooms 200 - 215, all COMMON gender).`);

  // ----------------------------------------------------
  // 5. Seed Predefined Hourly Therapy Slots
  // ----------------------------------------------------
  console.log("\n⏰ Seeding predefined hourly therapy slots (10:00 AM - 08:00 PM)...");
  const hourlySlots = [
    { label: "10:00 AM - 11:00 AM", startTime: "10:00", endTime: "11:00", order: 1 },
    { label: "11:00 AM - 12:00 PM", startTime: "11:00", endTime: "12:00", order: 2 },
    { label: "12:00 PM - 01:00 PM", startTime: "12:00", endTime: "13:00", order: 3 },
    { label: "01:00 PM - 02:00 PM", startTime: "13:00", endTime: "14:00", order: 4 },
    { label: "02:00 PM - 03:00 PM", startTime: "14:00", endTime: "15:00", order: 5 },
    { label: "03:00 PM - 04:00 PM", startTime: "15:00", endTime: "16:00", order: 6 },
    { label: "04:00 PM - 05:00 PM", startTime: "16:00", endTime: "17:00", order: 7 },
    { label: "05:00 PM - 06:00 PM", startTime: "17:00", endTime: "18:00", order: 8 },
    { label: "06:00 PM - 07:00 PM", startTime: "18:00", endTime: "19:00", order: 9 },
    { label: "07:00 PM - 08:00 PM", startTime: "19:00", endTime: "20:00", order: 10 },
  ];

  for (const s of hourlySlots) {
    await prisma.therapySlot.create({
      data: {
        label: s.label,
        startTime: s.startTime,
        endTime: s.endTime,
        order: s.order,
        status: SlotStatus.OPEN,
        isActive: true,
        weekDays: "ALL",
        roomId: createdRooms["207"],
        regularMaleCapacity: 3,
        regularFemaleCapacity: 3,
        extraMaleCapacity: 1,
        extraFemaleCapacity: 1,
      },
    });
  }
  console.log(`✅ Seeded ${hourlySlots.length} hourly therapy slots.`);

  // ----------------------------------------------------
  // 6. Seed Dynamic Clinical Options
  // ----------------------------------------------------
  console.log("\n🩺 Seeding dynamic clinical taxonomy options...");
  const clinicalOptions = [
    // Pain Areas
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Neck", order: 1 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Shoulder", order: 2 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Back", order: 3 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Knee", order: 4 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Heel", order: 5 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Elbow", order: 6 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Wrist", order: 7 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Hip", order: 8 },
    { category: ClinicalOptionCategory.PAIN_AREA, name: "Ankle", order: 9 },

    // Pain Types
    { category: ClinicalOptionCategory.PAIN_TYPE, name: "Sharp", order: 1 },
    { category: ClinicalOptionCategory.PAIN_TYPE, name: "Dull", order: 2 },
    { category: ClinicalOptionCategory.PAIN_TYPE, name: "Burning", order: 3 },
    { category: ClinicalOptionCategory.PAIN_TYPE, name: "Radiating", order: 4 },
    { category: ClinicalOptionCategory.PAIN_TYPE, name: "Throbbing", order: 5 },
    { category: ClinicalOptionCategory.PAIN_TYPE, name: "Aching", order: 6 },

    // Aggravating Factors
    { category: ClinicalOptionCategory.AGGRAVATING_FACTOR, name: "Movement", order: 1 },
    { category: ClinicalOptionCategory.AGGRAVATING_FACTOR, name: "Sitting", order: 2 },
    { category: ClinicalOptionCategory.AGGRAVATING_FACTOR, name: "Standing", order: 3 },
    { category: ClinicalOptionCategory.AGGRAVATING_FACTOR, name: "Walking", order: 4 },
    { category: ClinicalOptionCategory.AGGRAVATING_FACTOR, name: "Lifting", order: 5 },
    { category: ClinicalOptionCategory.AGGRAVATING_FACTOR, name: "Bending", order: 6 },

    // Relieving Factors
    { category: ClinicalOptionCategory.RELIEVING_FACTOR, name: "Rest", order: 1 },
    { category: ClinicalOptionCategory.RELIEVING_FACTOR, name: "Medicine", order: 2 },
    { category: ClinicalOptionCategory.RELIEVING_FACTOR, name: "Heat", order: 3 },
    { category: ClinicalOptionCategory.RELIEVING_FACTOR, name: "Cold / Ice pack", order: 4 },
    { category: ClinicalOptionCategory.RELIEVING_FACTOR, name: "Elevation", order: 5 },

    // Functional Limitations
    { category: ClinicalOptionCategory.FUNCTIONAL_LIMITATION, name: "Bending", order: 1 },
    { category: ClinicalOptionCategory.FUNCTIONAL_LIMITATION, name: "Sitting", order: 2 },
    { category: ClinicalOptionCategory.FUNCTIONAL_LIMITATION, name: "Standing", order: 3 },
    { category: ClinicalOptionCategory.FUNCTIONAL_LIMITATION, name: "Walking", order: 4 },
    { category: ClinicalOptionCategory.FUNCTIONAL_LIMITATION, name: "Lifting", order: 5 },
    { category: ClinicalOptionCategory.FUNCTIONAL_LIMITATION, name: "Climbing Stairs", order: 6 },

    // Treatment Plans / Modalities
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Hot pack", order: 1 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "IFT / TENS", order: 2 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Ultrasound Therapy", order: 3 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Cervical / Lumbar Traction", order: 4 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Stretching Exercises", order: 5 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Strengthening Exercises", order: 6 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Posture Correction", order: 7 },
    { category: ClinicalOptionCategory.TREATMENT_PLAN, name: "Manual Mobilization", order: 8 },
  ];

  await prisma.clinicalOption.createMany({
    data: clinicalOptions,
  });
  console.log(`✅ Seeded ${clinicalOptions.length} clinical assessment options.`);

  console.log("\n========================================================");
  console.log("🎉 Seeding completed successfully!");
  console.log("========================================================");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
