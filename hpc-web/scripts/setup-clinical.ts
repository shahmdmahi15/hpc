import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "hpc.db");
const db = new Database(dbPath);

console.log(
  "🛠️ Setting up ClinicalOption and MedicalRecord tables in SQLite...",
);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// 1. Create ClinicalOption table
db.exec(`
  CREATE TABLE IF NOT EXISTS "ClinicalOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS "ClinicalOption_category_idx" ON "ClinicalOption"("category");
  CREATE INDEX IF NOT EXISTS "ClinicalOption_isActive_idx" ON "ClinicalOption"("isActive");
  CREATE INDEX IF NOT EXISTS "ClinicalOption_order_idx" ON "ClinicalOption"("order");
`);

// 2. Create MedicalRecord table
db.exec(`
  CREATE TABLE IF NOT EXISTS "MedicalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "doctorId" TEXT,
    "assessmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "age" INTEGER,
    "occupation" TEXT,
    "painAreas" TEXT NOT NULL DEFAULT '[]',
    "painSide" TEXT,
    "duration" TEXT,
    "painTypes" TEXT NOT NULL DEFAULT '[]',
    "vasScore" INTEGER DEFAULT 0,
    "aggravatingFactors" TEXT NOT NULL DEFAULT '[]',
    "relievingFactors" TEXT NOT NULL DEFAULT '[]',
    "injuryAccident" BOOLEAN DEFAULT 0,
    "injuryDetails" TEXT,
    "postureAdviceGiven" BOOLEAN DEFAULT 0,
    "surgeryHistory" BOOLEAN DEFAULT 0,
    "surgeryDetails" TEXT,
    "previousTreatment" TEXT,
    "functionalLimitations" TEXT NOT NULL DEFAULT '[]',
    "rom" TEXT,
    "muscleSpasm" BOOLEAN DEFAULT 0,
    "tenderness" BOOLEAN DEFAULT 0,
    "swelling" BOOLEAN DEFAULT 0,
    "physicalExamNotes" TEXT,
    "diagnosis" TEXT,
    "treatmentPlans" TEXT NOT NULL DEFAULT '[]',
    "treatmentNotes" TEXT,
    "exerciseExplained" BOOLEAN DEFAULT 0,
    "homePostureAdvice" BOOLEAN DEFAULT 0,
    "followUpVasScore" INTEGER,
    "improvement" TEXT,
    "doctorSignature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedicalRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MedicalRecord_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Performer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "MedicalRecord_patientId_idx" ON "MedicalRecord"("patientId");
  CREATE INDEX IF NOT EXISTS "MedicalRecord_appointmentId_idx" ON "MedicalRecord"("appointmentId");
  CREATE INDEX IF NOT EXISTS "MedicalRecord_doctorId_idx" ON "MedicalRecord"("doctorId");
  CREATE INDEX IF NOT EXISTS "MedicalRecord_assessmentDate_idx" ON "MedicalRecord"("assessmentDate");
`);

console.log("✅ Tables created successfully!");

// 3. Seed default clinical options from Pain Physiotherapy Assessment form
const DEFAULT_OPTIONS = [
  // Pain Areas
  { category: "PAIN_AREA", name: "Neck", order: 1 },
  { category: "PAIN_AREA", name: "Shoulder", order: 2 },
  { category: "PAIN_AREA", name: "Back", order: 3 },
  { category: "PAIN_AREA", name: "Knee", order: 4 },
  { category: "PAIN_AREA", name: "Heel", order: 5 },
  { category: "PAIN_AREA", name: "Elbow", order: 6 },
  { category: "PAIN_AREA", name: "Wrist", order: 7 },
  { category: "PAIN_AREA", name: "Hip", order: 8 },
  { category: "PAIN_AREA", name: "Ankle", order: 9 },

  // Pain Types
  { category: "PAIN_TYPE", name: "Sharp", order: 1 },
  { category: "PAIN_TYPE", name: "Dull", order: 2 },
  { category: "PAIN_TYPE", name: "Burning", order: 3 },
  { category: "PAIN_TYPE", name: "Radiating", order: 4 },
  { category: "PAIN_TYPE", name: "Throbbing", order: 5 },
  { category: "PAIN_TYPE", name: "Aching", order: 6 },

  // Aggravating Factors (Pain increases with)
  { category: "AGGRAVATING_FACTOR", name: "Movement", order: 1 },
  { category: "AGGRAVATING_FACTOR", name: "Sitting", order: 2 },
  { category: "AGGRAVATING_FACTOR", name: "Standing", order: 3 },
  { category: "AGGRAVATING_FACTOR", name: "Walking", order: 4 },
  { category: "AGGRAVATING_FACTOR", name: "Lifting", order: 5 },
  { category: "AGGRAVATING_FACTOR", name: "Bending", order: 6 },

  // Relieving Factors (Pain reduces with)
  { category: "RELIEVING_FACTOR", name: "Rest", order: 1 },
  { category: "RELIEVING_FACTOR", name: "Medicine", order: 2 },
  { category: "RELIEVING_FACTOR", name: "Heat", order: 3 },
  { category: "RELIEVING_FACTOR", name: "Cold / Ice pack", order: 4 },
  { category: "RELIEVING_FACTOR", name: "Elevation", order: 5 },

  // Functional Limitations (Difficulty in)
  { category: "FUNCTIONAL_LIMITATION", name: "Bending", order: 1 },
  { category: "FUNCTIONAL_LIMITATION", name: "Sitting", order: 2 },
  { category: "FUNCTIONAL_LIMITATION", name: "Standing", order: 3 },
  { category: "FUNCTIONAL_LIMITATION", name: "Walking", order: 4 },
  { category: "FUNCTIONAL_LIMITATION", name: "Lifting", order: 5 },
  { category: "FUNCTIONAL_LIMITATION", name: "Climbing stairs", order: 6 },

  // Treatment Plans (Physiotherapy Modalities)
  {
    category: "TREATMENT_PLAN",
    name: "Hot pack",
    description: "Moist heat therapy for muscle relaxation",
    order: 1,
  },
  {
    category: "TREATMENT_PLAN",
    name: "IFT / TENS",
    description:
      "Interferential therapy / Transcutaneous electrical nerve stimulation",
    order: 2,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Ultrasound",
    description: "Therapeutic ultrasound for deep tissue heating",
    order: 3,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Stretching",
    description: "Targeted musculoskeletal stretching protocols",
    order: 4,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Strengthening",
    description: "Progressive resistive exercise & muscle stabilization",
    order: 5,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Posture correction",
    description: "Ergonomic & postural realignment retraining",
    order: 6,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Cervical / Lumbar Traction",
    description: "Mechanical spine decompressive traction",
    order: 7,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Manual Therapy",
    description: "Joint mobilization and soft tissue manipulation",
    order: 8,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Dry Needling",
    description: "Trigger point release therapy",
    order: 9,
  },
  {
    category: "TREATMENT_PLAN",
    name: "Laser Therapy",
    description: "Low-level laser therapy for tissue repair",
    order: 10,
  },
];

const checkStmt = db.prepare(
  `SELECT count(*) as count FROM "ClinicalOption" WHERE category = ? AND name = ?`,
);
const insertStmt = db.prepare(`
  INSERT INTO "ClinicalOption" ("id", "category", "name", "description", "order", "isActive", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
`);

let insertedCount = 0;
for (const opt of DEFAULT_OPTIONS) {
  const existing = checkStmt.get(opt.category, opt.name) as { count: number };
  if (existing.count === 0) {
    const id =
      "opt_" +
      Math.random().toString(36).substring(2, 11) +
      Date.now().toString(36);
    insertStmt.run(
      id,
      opt.category,
      opt.name,
      opt.description || null,
      opt.order,
    );
    insertedCount++;
  }
}

console.log(
  `🎉 Clinical options seeded! (${insertedCount} new items inserted)`,
);
db.close();
