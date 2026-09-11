import { z } from "zod";

export const createMedicalRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required."),
  appointmentId: z.string().optional(),
  doctorId: z.string().optional(),

  // Metadata
  age: z.coerce.number().int().min(0).max(150).optional(),
  occupation: z.string().trim().max(100).optional(),

  // Section 2: Pain Details
  painAreas: z.array(z.string()).default([]),
  painSide: z.enum(["Right", "Left", "Both", "N/A"]).optional(),
  duration: z.string().trim().max(100).optional(),
  painTypes: z.array(z.string()).default([]),

  // Section 3: Pain Scale & Triggers
  vasScore: z.coerce.number().int().min(0).max(10).default(0),
  aggravatingFactors: z.array(z.string()).default([]),
  relievingFactors: z.array(z.string()).default([]),

  // Section 4: Medical History
  injuryAccident: z.boolean().default(false),
  injuryDetails: z.string().trim().max(250).optional(),
  postureAdviceGiven: z.boolean().default(false),
  surgeryHistory: z.boolean().default(false),
  surgeryDetails: z.string().trim().max(250).optional(),
  previousTreatment: z.enum(["Medicine", "Physiotherapy", "Both", "None"]).optional(),

  // Section 5: Functional Limitation
  functionalLimitations: z.array(z.string()).default([]),

  // Section 6: Physical Examination
  rom: z.enum(["Normal", "Restricted"]).optional(),
  muscleSpasm: z.boolean().default(false),
  tenderness: z.boolean().default(false),
  swelling: z.boolean().default(false),
  physicalExamNotes: z.string().trim().max(500).optional(),

  // Section 7: Physiotherapy Diagnosis
  diagnosis: z.string().trim().max(250).optional(),

  // Section 8: Treatment Plan
  treatmentPlans: z.array(z.string()).default([]),
  treatmentNotes: z.string().trim().max(500).optional(),

  // Section 9: Home Advice
  exerciseExplained: z.boolean().default(false),
  homePostureAdvice: z.boolean().default(false),

  // Follow-up & Progress
  followUpVasScore: z.coerce.number().int().min(0).max(10).optional(),
  improvement: z.string().trim().max(500).optional(),
  doctorSignature: z.string().trim().max(100).optional(),
});

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;

export interface MedicalRecordActionState {
  success: boolean;
  message: string;
  recordId?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}
