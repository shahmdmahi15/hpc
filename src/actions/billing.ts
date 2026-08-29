"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import {
  PaymentMethod,
  PaymentStatus,
  PackageStatus,
  AuditAction,
} from "@/generated/prisma/enums";
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
      treatmentSession: true,
      cashier: { select: { id: true, name: true } },
      auditedBy: { select: { id: true, name: true } },
    },
  });
}

export async function recordCashierEntry(data: {
  patientId: string;
  actualBill: number;
  paidAmount: number;
  refundedAmount?: number;
  advanceAmount?: number;
  isPackageCovered?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  notes?: string;
  packageId?: string;
  serialId?: string;
  treatmentSessionId?: string;
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

  const actualBill = Math.max(0, Number(data.actualBill) || 0);
  const paidAmount = data.isPackageCovered
    ? 0
    : Math.max(0, Number(data.paidAmount) || 0);
  const refundedAmount = Math.max(0, Number(data.refundedAmount) || 0);
  const discount = Math.max(0, Number(data.advanceAmount) || 0);
  const netRetained = Math.max(0, paidAmount - refundedAmount);
  const dueAmount = data.isPackageCovered
    ? 0
    : Math.max(0, actualBill - discount - netRetained);

  let paymentStatus = data.paymentStatus;
  if (data.isPackageCovered) {
    paymentStatus = PaymentStatus.PAID;
  } else if (
    refundedAmount > 0 &&
    refundedAmount >= paidAmount &&
    paidAmount > 0
  ) {
    paymentStatus = PaymentStatus.REFUNDED;
  } else if (refundedAmount > 0 && refundedAmount < paidAmount) {
    paymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
  } else if (!paymentStatus) {
    if (netRetained >= actualBill - discount && actualBill > 0) {
      paymentStatus = PaymentStatus.PAID;
    } else if (netRetained > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      paymentStatus = PaymentStatus.UNPAID;
    }
  }

  const billingRecord = await prisma.billingRecord.create({
    data: {
      patientId: patient.id,
      packageId: data.packageId || null,
      serialId: data.serialId || null,
      treatmentSessionId: data.treatmentSessionId || null,
      actualBill,
      paidAmount,
      refundedAmount,
      advanceAmount: discount,
      dueAmount,
      isPackageCovered: !!data.isPackageCovered,
      paymentStatus: paymentStatus || PaymentStatus.PAID,
      paymentMethod: data.paymentMethod || PaymentMethod.CASH,
      cashierId: session?.user?.id || null,
      notes:
        data.notes ||
        (paymentStatus === PaymentStatus.REFUNDED
          ? `Full Refund: ৳${refundedAmount}`
          : paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
            ? `Partial Refund: ৳${refundedAmount} (Net: ৳${netRetained})`
            : data.isPackageCovered
              ? "Package Covered Session"
              : "Desk Collection"),
    },
    include: {
      patient: true,
      cashier: true,
      package: true,
      serial: true,
      treatmentSession: true,
    },
  });

  // If associated with a package, update package collected & due amounts
  if (data.packageId) {
    await prisma.patientPackage.update({
      where: { id: data.packageId },
      data: {
        paidAmount: { increment: netRetained },
        refundedAmount: { increment: refundedAmount },
      },
    });
  }

  realtimeBus.notify("BILLING_RECORDED", { billingRecord });
  revalidatePath("/admin");
  revalidatePath("/admin/ledger");
  revalidatePath("/receptionist");

  return { success: true, billingRecord };
}

export async function createOrUpdatePackage(data: {
  patientId: string;
  packageName: string;
  totalDays: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
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

  const totalAmount = Math.max(0, Number(data.totalAmount) || 0);
  const paidAmount = Math.max(0, Number(data.paidAmount) || 0);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  const pkg = await prisma.patientPackage.create({
    data: {
      patientId: patient.id,
      packageName: data.packageName,
      totalDays: data.totalDays || 30,
      totalAmount,
      paidAmount,
      dueAmount,
      status: PackageStatus.ACTIVE,
      notes: data.notes || null,
    },
    include: { patient: true },
  });

  // Create initial billing record for package deposit
  if (paidAmount > 0) {
    await prisma.billingRecord.create({
      data: {
        patientId: patient.id,
        packageId: pkg.id,
        actualBill: totalAmount,
        paidAmount,
        dueAmount,
        isPackageCovered: false,
        paymentStatus:
          paidAmount >= totalAmount
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIALLY_PAID,
        paymentMethod: data.paymentMethod || PaymentMethod.CASH,
        cashierId: session?.user?.id || null,
        notes: `Package Advance Deposit: ${data.packageName}`,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: AuditAction.BILLING_CREATE,
      entity: "PatientPackage",
      entityId: pkg.id,
      userId: session?.user?.id || null,
      details: `Created package '${pkg.packageName}' for ${patient.name} (#${patient.patientId}): Total ৳${totalAmount}, Paid ৳${paidAmount}, Due ৳${dueAmount}`,
    },
  });

  realtimeBus.notify("BILLING_RECORDED", { package: pkg });
  revalidatePath("/admin");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/ledger");
  revalidatePath("/receptionist");

  return { success: true, package: pkg };
}

export async function getPatientPackages(patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: patientId }, { patientId: patientId }],
    },
  });

  if (!patient) return [];

  return prisma.patientPackage.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: "desc" },
    include: {
      serials: {
        select: { id: true, serialNumber: true, date: true, status: true },
      },
      treatmentSessions: {
        select: { id: true, sessionNumber: true, date: true },
      },
      billingRecords: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function recordTreatmentPayment(data: {
  sessionId: string;
  fee?: number;
  paidAmount: number;
  refundedAmount?: number;
  discount?: number;
  isPackageCovered?: boolean;
  packageId?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  notes?: string;
}) {
  const session = await getCurrentSession();

  const existing = await prisma.treatmentSession.findUnique({
    where: { id: data.sessionId },
    include: {
      patient: true,
      billingRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!existing) {
    return { error: "Treatment session not found." };
  }

  const fee =
    data.fee !== undefined
      ? Math.max(0, Number(data.fee))
      : existing.fee || 800;
  const isNP = Boolean(data.isPackageCovered) || Boolean(data.packageId);
  const discount = Math.max(0, Number(data.discount) || 0);
  const netPayable = Math.max(0, fee - discount);
  let paidAmount = isNP ? 0 : Math.max(0, Number(data.paidAmount) || 0);
  let refundedAmount = Math.max(0, Number(data.refundedAmount) || 0);

  if (data.paymentStatus === PaymentStatus.REFUNDED) {
    if (refundedAmount === 0) {
      refundedAmount =
        paidAmount > 0
          ? paidAmount
          : existing.paidAmount > 0
            ? existing.paidAmount
            : fee;
    }
  }

  let finalPaymentStatus = data.paymentStatus || PaymentStatus.UNPAID;
  if (isNP) {
    finalPaymentStatus = PaymentStatus.PAID;
  } else if (
    refundedAmount > 0 &&
    refundedAmount >= paidAmount &&
    paidAmount > 0
  ) {
    finalPaymentStatus = PaymentStatus.REFUNDED;
  } else if (refundedAmount > 0 && refundedAmount < paidAmount) {
    finalPaymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
  } else if (!data.paymentStatus) {
    const netRetained = Math.max(0, paidAmount - refundedAmount);
    if (netRetained >= netPayable && netPayable > 0) {
      finalPaymentStatus = PaymentStatus.PAID;
    } else if (netRetained > 0) {
      finalPaymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      finalPaymentStatus = PaymentStatus.UNPAID;
    }
  }

  const netRetainedCash = Math.max(0, paidAmount - refundedAmount);
  const dueAmount = isNP ? 0 : Math.max(0, netPayable - netRetainedCash);
  const paymentMethod =
    data.paymentMethod || existing.paymentMethod || PaymentMethod.CASH;

  const existingBilling = existing.billingRecords?.[0];

  const operations: any[] = [
    prisma.treatmentSession.update({
      where: { id: data.sessionId },
      data: {
        fee,
        paidAmount,
        refundedAmount,
        discountAmount: discount,
        isPackageCovered: isNP,
        packageId: data.packageId || null,
        paymentStatus: finalPaymentStatus,
        paymentMethod,
      },
    }),
  ];

  if (existingBilling) {
    operations.push(
      prisma.billingRecord.update({
        where: { id: existingBilling.id },
        data: {
          actualBill: fee,
          paidAmount,
          refundedAmount,
          advanceAmount: discount,
          dueAmount,
          isPackageCovered: isNP,
          packageId: data.packageId || null,
          paymentStatus: finalPaymentStatus,
          paymentMethod,
          cashierId: session?.user?.id || existingBilling.cashierId || null,
          notes:
            data.notes?.trim() ||
            `Treatment Session #${existing.sessionNumber || 1} Payment Updated`,
        },
      }),
    );
  } else {
    operations.push(
      prisma.billingRecord.create({
        data: {
          patientId: existing.patientId,
          treatmentSessionId: existing.id,
          packageId: data.packageId || null,
          actualBill: fee,
          paidAmount,
          refundedAmount,
          advanceAmount: discount,
          dueAmount,
          isPackageCovered: isNP,
          paymentStatus: finalPaymentStatus,
          paymentMethod,
          cashierId: session?.user?.id || null,
          notes:
            data.notes?.trim() ||
            `Treatment Session #${existing.sessionNumber || 1} Payment`,
        },
      }),
    );
  }

  const [updatedSession, billingRecord] = await prisma.$transaction(operations);

  realtimeBus.notify("PAYMENT_RECORDED", {
    treatmentSession: updatedSession,
    billingRecord,
    paidAmount,
    refundedAmount,
    netRetainedCash,
    paymentStatus: finalPaymentStatus,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/ledger");
  revalidatePath("/receptionist");
  revalidatePath("/handler");

  return { success: true, treatmentSession: updatedSession, billingRecord };
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
  revalidatePath("/admin/ledger");
  revalidatePath("/receptionist");

  return { success: true, billingRecord };
}

export async function getAllPackages() {
  return prisma.patientPackage.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      patient: true,
      serials: true,
      treatmentSessions: true,
      billingRecords: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
