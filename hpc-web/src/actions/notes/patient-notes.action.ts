"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { revalidatePath } from "next/cache";

export type NoteCategory =
  | "FORWARDED"
  | "RECEPTIONIST"
  | "DOCTOR"
  | "HANDLER"
  | "CASHIER"
  | "MEDICAL";

export interface PatientVisitNoteRecord {
  id: string;
  patientId: string;
  visitId: string | null;
  appointmentId: string | null;
  category: NoteCategory;
  note: string;
  authorName: string | null;
  authorRole: string | null;
  authorId: string | null;
  originStation: string | null;
  targetStation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientNotesResponse {
  success: boolean;
  notes: PatientVisitNoteRecord[];
  categorized: {
    forwarded: PatientVisitNoteRecord[];
    receptionist: PatientVisitNoteRecord[];
    doctor: PatientVisitNoteRecord[];
    handler: PatientVisitNoteRecord[];
    cashier: PatientVisitNoteRecord[];
    medical: PatientVisitNoteRecord[];
  };
  counts: {
    all: number;
    forwarded: number;
    receptionist: number;
    doctor: number;
    handler: number;
    cashier: number;
    medical: number;
  };
  message?: string;
}

/**
 * Fetches all notes for a patient and visit, categorized and chronologically sorted.
 */
export async function getPatientVisitNotesAction(params: {
  patientId: string;
  visitId?: string;
  appointmentId?: string;
}): Promise<PatientNotesResponse> {
  try {
    await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.RECEPTIONIST,
      Role.CASHIER,
    ]);

    if (!params.patientId) {
      return {
        success: false,
        notes: [],
        categorized: {
          forwarded: [],
          receptionist: [],
          doctor: [],
          handler: [],
          cashier: [],
          medical: [],
        },
        counts: {
          all: 0,
          forwarded: 0,
          receptionist: 0,
          doctor: 0,
          handler: 0,
          cashier: 0,
          medical: 0,
        },
        message: "Patient ID is required.",
      };
    }

    const rawNotes = await prisma.patientVisitNote.findMany({
      where: {
        patientId: params.patientId,
        ...(params.visitId ? { OR: [{ visitId: params.visitId }, { appointmentId: params.appointmentId }] } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const notes: PatientVisitNoteRecord[] = rawNotes.map((n) => ({
      id: n.id,
      patientId: n.patientId,
      visitId: n.visitId,
      appointmentId: n.appointmentId,
      category: n.category as NoteCategory,
      note: n.note,
      authorName: n.authorName,
      authorRole: n.authorRole,
      authorId: n.authorId,
      originStation: n.originStation,
      targetStation: n.targetStation,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    const categorized = {
      forwarded: notes.filter((n) => n.category === "FORWARDED"),
      receptionist: notes.filter((n) => n.category === "RECEPTIONIST"),
      doctor: notes.filter((n) => n.category === "DOCTOR"),
      handler: notes.filter((n) => n.category === "HANDLER"),
      cashier: notes.filter((n) => n.category === "CASHIER"),
      medical: notes.filter((n) => n.category === "MEDICAL"),
    };

    return {
      success: true,
      notes,
      categorized,
      counts: {
        all: notes.length,
        forwarded: categorized.forwarded.length,
        receptionist: categorized.receptionist.length,
        doctor: categorized.doctor.length,
        handler: categorized.handler.length,
        cashier: categorized.cashier.length,
        medical: categorized.medical.length,
      },
    };
  } catch (err) {
    console.error("[getPatientVisitNotesAction Error]:", err);
    return {
      success: false,
      notes: [],
      categorized: {
        forwarded: [],
        receptionist: [],
        doctor: [],
        handler: [],
        cashier: [],
        medical: [],
      },
      counts: {
        all: 0,
        forwarded: 0,
        receptionist: 0,
        doctor: 0,
        handler: 0,
        cashier: 0,
        medical: 0,
      },
      message: "Failed to fetch visit notes.",
    };
  }
}

/**
 * Creates a new note and persists it to PatientVisitNote and the corresponding department column.
 */
export async function addPatientVisitNoteAction(params: {
  patientId: string;
  visitId?: string;
  appointmentId?: string;
  category: NoteCategory;
  note: string;
  authorName?: string;
  authorRole?: string;
  authorId?: string;
  originStation?: string;
  targetStation?: string;
}): Promise<{ success: boolean; message: string; note?: PatientVisitNoteRecord }> {
  try {
    const sessionData = await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.RECEPTIONIST,
      Role.CASHIER,
    ]);

    const trimmedNote = (params.note || "").trim();
    if (!trimmedNote) {
      return { success: false, message: "Note text cannot be empty." };
    }

    const effectiveAuthorName =
      params.authorName || sessionData.user.name || "Clinic Staff";
    const effectiveAuthorRole =
      params.authorRole || sessionData.user.role || "STAFF";
    const effectiveAuthorId = params.authorId || sessionData.user.id;

    // Resolve visitId if only appointmentId was provided
    let effectiveVisitId = params.visitId;
    if (!effectiveVisitId && params.appointmentId) {
      const apt = await prisma.appointment.findUnique({
        where: { id: params.appointmentId },
        select: { visitId: true },
      });
      effectiveVisitId = apt?.visitId || undefined;
    }

    const created = await prisma.patientVisitNote.create({
      data: {
        patientId: params.patientId,
        visitId: effectiveVisitId,
        appointmentId: params.appointmentId,
        category: params.category,
        note: trimmedNote,
        authorName: effectiveAuthorName,
        authorRole: effectiveAuthorRole,
        authorId: effectiveAuthorId,
        originStation: params.originStation,
        targetStation: params.targetStation,
      },
    });

    // Mirror to specific department fields on Appointment and PatientVisit for rapid retrieval
    if (params.appointmentId) {
      const updateData: Record<string, string | null> = {};
      if (params.category === "RECEPTIONIST") updateData.receptionistNote = trimmedNote;
      else if (params.category === "DOCTOR") updateData.doctorNote = trimmedNote;
      else if (params.category === "HANDLER") updateData.handlerNote = trimmedNote;
      else if (params.category === "CASHIER") updateData.cashierNote = trimmedNote;
      else if (params.category === "FORWARDED") updateData.routingNote = trimmedNote;

      if (Object.keys(updateData).length > 0) {
        await prisma.appointment
          .update({
            where: { id: params.appointmentId },
            data: updateData,
          })
          .catch((err) => console.error("[Update Apt Note Column Error]:", err));
      }
    }

    if (effectiveVisitId) {
      const visitUpdateData: Record<string, string | null> = {};
      if (params.category === "RECEPTIONIST") visitUpdateData.receptionistNote = trimmedNote;
      else if (params.category === "DOCTOR") visitUpdateData.doctorNote = trimmedNote;
      else if (params.category === "HANDLER") visitUpdateData.handlerNote = trimmedNote;
      else if (params.category === "CASHIER") visitUpdateData.cashierNote = trimmedNote;
      else if (params.category === "MEDICAL") visitUpdateData.medicalNotes = trimmedNote;

      if (Object.keys(visitUpdateData).length > 0) {
        await prisma.patientVisit
          .update({
            where: { id: effectiveVisitId },
            data: visitUpdateData,
          })
          .catch((err) => console.error("[Update Visit Note Column Error]:", err));
      }
    }

    const record: PatientVisitNoteRecord = {
      id: created.id,
      patientId: created.patientId,
      visitId: created.visitId,
      appointmentId: created.appointmentId,
      category: created.category as NoteCategory,
      note: created.note,
      authorName: created.authorName,
      authorRole: created.authorRole,
      authorId: created.authorId,
      originStation: created.originStation,
      targetStation: created.targetStation,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    emitRealtimeEvent("PATIENT_NOTE_ADDED", {
      patientId: params.patientId,
      appointmentId: params.appointmentId,
      category: params.category,
      authorName: effectiveAuthorName,
      note: trimmedNote,
    });

    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/cashier");
    revalidatePath("/receptionist");

    return {
      success: true,
      message: `${params.category.charAt(0) + params.category.slice(1).toLowerCase()} note saved successfully.`,
      note: record,
    };
  } catch (err) {
    console.error("[addPatientVisitNoteAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to add note.",
    };
  }
}
