"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";

export interface PrescriptionMedicineDirectoryItem {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  company: string | null;
  defaultMealTiming: "BEFORE" | "AFTER";
  defaultTimes: ("MORNING" | "AFTERNOON" | "NIGHT")[];
  defaultDuration: string;
  instructions: string | null;
}

/**
 * Searches the verified clinical medicine directory for doctor prescribing.
 * Strict: only active medicines from directory are returned.
 */
export async function searchPrescriptionMedicinesAction(
  query: string,
  limit = 20,
): Promise<{ success: boolean; data: PrescriptionMedicineDirectoryItem[]; error?: string }> {
  try {
    await requireAuth([Role.DOCTOR, Role.ADMIN]);

    const q = query.trim();

    const where: any = {
      isActive: true,
    };

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { genericName: { contains: q } },
        { strength: { contains: q } },
        { company: { contains: q } },
      ];
    }

    const medicines = await prisma.medicine.findMany({
      where,
      orderBy: [{ order: "asc" }, { name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        genericName: true,
        strength: true,
        form: true,
        company: true,
        defaultMealTiming: true,
        defaultTimes: true,
        defaultDuration: true,
        instructions: true,
      },
    });

    const parsedData: PrescriptionMedicineDirectoryItem[] = medicines.map((m) => {
      let times: ("MORNING" | "AFTERNOON" | "NIGHT")[] = ["MORNING", "NIGHT"];
      try {
        if (m.defaultTimes) {
          const parsed = JSON.parse(m.defaultTimes);
          if (Array.isArray(parsed)) {
            times = parsed as ("MORNING" | "AFTERNOON" | "NIGHT")[];
          }
        }
      } catch {}

      return {
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        strength: m.strength,
        form: m.form,
        company: m.company,
        defaultMealTiming: (m.defaultMealTiming === "BEFORE" ? "BEFORE" : "AFTER") as
          | "BEFORE"
          | "AFTER",
        defaultTimes: times,
        defaultDuration: m.defaultDuration || "7 days",
        instructions: m.instructions,
      };
    });

    return {
      success: true,
      data: parsedData,
    };
  } catch (err: any) {
    console.error("[searchPrescriptionMedicinesAction Error]:", err);
    return {
      success: false,
      data: [],
      error: err?.message || "Failed to search medicine directory.",
    };
  }
}
