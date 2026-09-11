"use server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  Gender,
} from "@/generated/prisma/enums";
import {
  createPatientSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
  type PatientActionState,
} from "@/schemas/receptionist/patient.schema";
import { logAudit } from "@/lib/audit";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { revalidatePath } from "next/cache";

/**
 * Registers a new patient with automated Medical Record Number (MRN) generation.
 * Emits real-time PATIENT_CREATED event to connected receptionists.
 */
export async function createPatientAction(
  data: CreatePatientInput,
): Promise<PatientActionState> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);
    const validation = createPatientSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        message: "Please correct the invalid patient information.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const { name, phone, gender, age, dateOfBirth, address, emergencyPhone } =
      validation.data;

    // Check if duplicate patient phone exists
    const existing = await prisma.patient.findFirst({
      where: { phone },
    });

    if (existing) {
      // Return existing patient info with notice
      return {
        success: true,
        message: `Existing patient with phone ${phone} found (${existing.name}).`,
        patient: existing,
      };
    }

    // Generate unique MRN (e.g. HPC-2026-0042)
    const currentYear = new Date().getFullYear();
    const count = await prisma.patient.count();
    const mrn = `HPC-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    const newPatient = await prisma.patient.create({
      data: {
        mrn,
        name,
        phone,
        gender: gender as Gender,
        age: age || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address: address || undefined,
        emergencyPhone: emergencyPhone || undefined,
      },
    });

    // Audit log
    await logAudit({
      userId: sessionData.user.id,
      performerId: validation.data.performerId || null,
      action: AuditAction.USER_CREATE,
      entity: "Patient",
      entityId: newPatient.id,
      status: AuditStatus.SUCCESS,
      details: {
        name: newPatient.name,
        phone: newPatient.phone,
        mrn: newPatient.mrn,
        gender: newPatient.gender,
      },
    });

    // Realtime broadcast to all local clients
    emitRealtimeEvent("PATIENT_CREATED", {
      id: newPatient.id,
      mrn: newPatient.mrn,
      name: newPatient.name,
      phone: newPatient.phone,
      gender: newPatient.gender,
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");

    return {
      success: true,
      message: `Patient "${newPatient.name}" registered successfully with MRN ${newPatient.mrn}.`,
      patient: newPatient,
    };
  } catch (error) {
    console.error("[Create Patient Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to register patient.",
    };
  }
}

/**
 * Updates an existing patient profile with audit logging and realtime notification.
 */
export async function updatePatientAction(
  data: UpdatePatientInput,
): Promise<PatientActionState> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);
    const validation = updatePatientSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        message: "Please correct the invalid patient information.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const { id, name, phone, gender, age, dateOfBirth, address, emergencyPhone } =
      validation.data;

    // Verify patient exists
    const existing = await prisma.patient.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Patient record not found.",
      };
    }

    // Check if duplicate phone is already assigned to a DIFFERENT patient
    const duplicatePhone = await prisma.patient.findFirst({
      where: {
        phone,
        id: { not: id },
      },
    });

    if (duplicatePhone) {
      return {
        success: false,
        message: `Phone number ${phone} is already registered to another patient (${duplicatePhone.name}, MRN: ${duplicatePhone.mrn || "N/A"}).`,
      };
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        name,
        phone,
        gender: gender as Gender,
        age: age !== undefined ? age : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address !== undefined ? address : null,
        emergencyPhone: emergencyPhone !== undefined ? emergencyPhone : null,
      },
      include: {
        _count: { select: { appointments: true } },
      },
    });

    // Audit log
    await logAudit({
      userId: sessionData.user.id,
      performerId: validation.data.performerId || null,
      action: AuditAction.PATIENT_UPDATE,
      entity: "Patient",
      entityId: updatedPatient.id,
      status: AuditStatus.SUCCESS,
      details: {
        old: {
          name: existing.name,
          phone: existing.phone,
          gender: existing.gender,
          age: existing.age,
          address: existing.address,
        },
        new: {
          name: updatedPatient.name,
          phone: updatedPatient.phone,
          gender: updatedPatient.gender,
          age: updatedPatient.age,
          address: updatedPatient.address,
        },
      },
    });

    // Realtime broadcast to connected panels
    emitRealtimeEvent("PATIENT_UPDATED", {
      id: updatedPatient.id,
      mrn: updatedPatient.mrn,
      name: updatedPatient.name,
      phone: updatedPatient.phone,
      gender: updatedPatient.gender,
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/cashier");
    revalidatePath("/handler");

    return {
      success: true,
      message: `Patient "${updatedPatient.name}" updated successfully.`,
      patient: updatedPatient,
    };
  } catch (error) {
    console.error("[Update Patient Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update patient information.",
    };
  }
}

/**
 * Searches registered patients by name, phone, or MRN.
 */
export async function searchPatientsAction(query: string) {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);

    if (!query || query.trim().length === 0) {
      return await prisma.patient.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    }

    const q = query.trim();

    return await prisma.patient.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { mrn: { contains: q } },
        ],
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Search Patients Error]:", error);
    return [];
  }
}

/**
 * Gets recent patients for quick reception desk selection.
 */
export async function getRecentPatientsAction(limit = 10) {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);
    return await prisma.patient.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Get Recent Patients Error]:", error);
    return [];
  }
}

export type PatientWithStats = {
  id: string;
  mrn: string | null;
  name: string;
  phone: string;
  gender: Gender;
  age: number | null;
  dateOfBirth: Date | null;
  address: string | null;
  emergencyPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { appointments: number };
};

/**
 * Loads patients directory with optional search query and gender filtering.
 */
export async function getPatientsListAction(params?: {
  query?: string;
  gender?: Gender | "ALL";
  limit?: number;
}): Promise<PatientWithStats[]> {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);
    const query = params?.query?.trim();
    const gender =
      params?.gender && params.gender !== "ALL" ? params.gender : undefined;

    const where: Prisma.PatientWhereInput = {};
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { phone: { contains: query } },
        { mrn: { contains: query } },
      ];
    }
    if (gender) {
      where.gender = gender;
    }

    return await prisma.patient.findMany({
      where,
      include: {
        _count: { select: { appointments: true } },
      },
      take: params?.limit || 50,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Get Patients List Error]:", error);
    return [];
  }
}
