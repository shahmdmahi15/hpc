"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import { PaymentMethod, PackageStatus } from "@/generated/prisma/enums";
import { getStartAndEndOfBSTDay } from "@/lib/date";
import { revalidatePath } from "next/cache";

export async function getDailyCashLedger(dateStr?: string) {
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  return prisma.billingRecord.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      patient: true,
      serial: true,
      package: true,
      cashier: { select: { id: true, name: true } },
      auditedBy: { select: { id: true, name: true } },
    },
  });
}

export async function recordCashierEntry(data: {
  patientId: string;
  actualBill: number;
  paidAmount: number;
  advanceAmount?: number;
  isPackageCovered?: boolean;
  paymentMethod?: PaymentMethod;
  notes?: string;
  packageId?: string;
  serialId?: string;
}) {
  const session = await getCurrentSession();

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  const dueAmount = Math.max(
    0,
    data.actualBill - data.paidAmount - (data.advanceAmount || 0),
  );

  const billingRecord = await prisma.billingRecord.create({
    data: {
      patientId: patient.id,
      packageId: data.packageId || null,
      serialId: data.serialId || null,
      actualBill: data.actualBill,
      paidAmount: data.paidAmount,
      advanceAmount: data.advanceAmount || 0,
      dueAmount,
      isPackageCovered: !!data.isPackageCovered,
      paymentMethod: data.paymentMethod || PaymentMethod.CASH,
      cashierId: session?.user?.id || null,
      notes: data.notes || (data.isPackageCovered ? "N.P" : null),
    },
    include: {
      patient: true,
      cashier: true,
    },
  });

  // If associated with a package, update package collected & due amounts
  if (data.packageId) {
    await prisma.patientPackage.update({
      where: { id: data.packageId },
      data: {
        paidAmount: { increment: data.paidAmount },
        dueAmount: { decrement: data.paidAmount },
      },
    });
  }

  realtimeBus.notify("BILLING_RECORDED", { billingRecord });
  revalidatePath("/admin");
  revalidatePath("/receptionist");

  return { success: true, billingRecord };
}

export async function createOrUpdatePackage(data: {
  patientId: string;
  packageName: string;
  totalDays: number;
  totalAmount: number;
  paidAmount: number;
  notes?: string;
}) {
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  const dueAmount = Math.max(0, data.totalAmount - data.paidAmount);

  const pkg = await prisma.patientPackage.create({
    data: {
      patientId: patient.id,
      packageName: data.packageName,
      totalDays: data.totalDays || 30,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      dueAmount,
      status: PackageStatus.ACTIVE,
      notes: data.notes || null,
    },
    include: { patient: true },
  });

  // Create initial billing record
  if (data.paidAmount > 0) {
    await prisma.billingRecord.create({
      data: {
        patientId: patient.id,
        packageId: pkg.id,
        actualBill: data.totalAmount,
        paidAmount: data.paidAmount,
        dueAmount,
        isPackageCovered: false,
        paymentMethod: PaymentMethod.CASH,
        notes: `Package Advance: ${data.packageName}`,
      },
    });
  }

  realtimeBus.notify("BILLING_RECORDED", { package: pkg });
  revalidatePath("/admin");
  revalidatePath("/receptionist");

  return { success: true, package: pkg };
}

export async function auditLedgerEntry(billingRecordId: string) {
  const session = await getCurrentSession();

  const billingRecord = await prisma.billingRecord.update({
    where: { id: billingRecordId },
    data: {
      auditedById: session?.user?.id || null,
    },
    include: {
      patient: true,
      auditedBy: true,
    },
  });

  realtimeBus.notify("LEDGER_AUDITED", { billingRecord });
  revalidatePath("/admin");
  revalidatePath("/receptionist");

  return { success: true, billingRecord };
}

export async function getAllPackages() {
  return prisma.patientPackage.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      patient: true,
      billingRecords: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
