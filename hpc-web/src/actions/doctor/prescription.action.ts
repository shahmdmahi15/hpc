"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus } from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";

export interface PrescriptionMedicineItem {
  id: string;
  name: string;
  mealTiming: "BEFORE" | "AFTER";
  times: ("MORNING" | "AFTERNOON" | "NIGHT")[];
  duration: string;
  instructions?: string;
}

export interface CreatePrescriptionInput {
  patientId: string;
  doctorId?: string;
  appointmentId?: string;
  diagnosis?: string;
  medicines: PrescriptionMedicineItem[];
  advice?: string;
  followUpDate?: string | null;
}

export interface PrescriptionActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export async function createPrescriptionAction(
  input: CreatePrescriptionInput,
): Promise<PrescriptionActionResult<{ id: string; [key: string]: any }>> {
  try {
    const session = await requireAuth();

    if (!input.patientId) {
      return { success: false, message: "Patient ID is required." };
    }

    if (!input.medicines || input.medicines.length === 0) {
      return { success: false, message: "At least one medicine is required in the prescription." };
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true, name: true, mrn: true },
    });

    if (!patient) {
      return { success: false, message: "Patient not found." };
    }

    const doctorId = input.doctorId || session.user.id;
    const followUp = input.followUpDate ? new Date(input.followUpDate) : null;

    const prescription = await prisma.prescription.create({
      data: {
        patientId: input.patientId,
        doctorId,
        appointmentId: input.appointmentId || null,
        diagnosis: input.diagnosis?.trim() || null,
        medicines: JSON.stringify(input.medicines),
        advice: input.advice?.trim() || null,
        followUpDate: followUp,
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
            mrn: true,
            phone: true,
            age: true,
            gender: true,
          },
        },
      },
    });

    await logAudit({
      userId: session.user.id,
      action: AuditAction.TREATMENT_PLAN_CREATE,
      entity: "Prescription",
      entityId: prescription.id,
      status: AuditStatus.SUCCESS,
      details: {
        patientId: input.patientId,
        patientName: patient.name,
        medicinesCount: input.medicines.length,
      },
    });

    emitRealtimeEvent("PRESCRIPTION_CREATED", {
      prescriptionId: prescription.id,
      patientId: input.patientId,
      patientName: patient.name,
      doctorId,
    });

    revalidatePath("/doctor");
    return {
      success: true,
      message: "Prescription created successfully.",
      data: prescription,
    };
  } catch (error: any) {
    console.error("[Create Prescription Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to create prescription.",
    };
  }
}

export async function getPatientPrescriptionsAction(
  patientId: string,
): Promise<PrescriptionActionResult<any[]>> {
  try {
    await requireAuth();

    if (!patientId) {
      return { success: false, message: "Patient ID is required.", data: [] };
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
            mrn: true,
            phone: true,
            age: true,
            gender: true,
          },
        },
      },
    });

    const parsed = prescriptions.map((p) => {
      let medicines: PrescriptionMedicineItem[] = [];
      try {
        medicines = JSON.parse(p.medicines);
      } catch {
        medicines = [];
      }
      return {
        ...p,
        medicines,
      };
    });

    return {
      success: true,
      message: "Prescriptions retrieved successfully.",
      data: parsed,
    };
  } catch (error: any) {
    console.error("[Get Prescriptions Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to load prescriptions.",
      data: [],
    };
  }
}

export async function deletePrescriptionAction(
  prescriptionId: string,
): Promise<PrescriptionActionResult> {
  try {
    const session = await requireAuth();

    const existing = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
    });

    if (!existing) {
      return { success: false, message: "Prescription not found." };
    }

    // Only creator or admin can delete
    if (session.user.role !== Role.ADMIN && existing.doctorId !== session.user.id) {
      return { success: false, message: "Permission denied." };
    }

    await prisma.prescription.delete({
      where: { id: prescriptionId },
    });

    await logAudit({
      userId: session.user.id,
      action: AuditAction.TREATMENT_PLAN_DELETE,
      entity: "Prescription",
      entityId: prescriptionId,
      status: AuditStatus.SUCCESS,
      details: { patientId: existing.patientId },
    });

    emitRealtimeEvent("PRESCRIPTION_DELETED", {
      prescriptionId,
      patientId: existing.patientId,
    });

    revalidatePath("/doctor");
    return { success: true, message: "Prescription deleted successfully." };
  } catch (error: any) {
    console.error("[Delete Prescription Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to delete prescription.",
    };
  }
}
