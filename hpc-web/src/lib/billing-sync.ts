import prisma from "@/lib/prisma";

/**
 * Synchronizes multi-tier billing amounts across:
 * 1. Appointment: ensures paidAmount & dueAmount match feeAmount and paymentStatus
 * 2. MedicalRecord (Episode File): computes totalBill, totalPaid, totalDue across all linked appointments
 * 3. Patient: computes lifetime totalBill, totalPaid, totalDue across all patient appointments
 */
export async function syncBillingForAppointment(appointmentId: string): Promise<void> {
  try {
    const apt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        feeAmount: true,
        paymentStatus: true,
        paidAmount: true,
        dueAmount: true,
        medicalRecordId: true,
      },
    });

    if (!apt) return;

    const fee = apt.feeAmount ?? 0;
    const isPaid = apt.paymentStatus === "PAID";
    const rawPaid =
      apt.paidAmount !== null && apt.paidAmount !== undefined && (apt.paidAmount > 0 || !isPaid)
        ? apt.paidAmount
        : (isPaid ? fee : 0);
    const calculatedPaid = Math.max(0, rawPaid);
    const calculatedDue = isPaid ? 0 : Math.max(0, fee - calculatedPaid);
    const resolvedStatus =
      fee > 0
        ? (calculatedDue === 0 ? "PAID" : (calculatedPaid > 0 ? "PARTIAL" : (apt.paymentStatus || "PENDING")))
        : (isPaid ? "PAID" : (apt.paymentStatus || "PENDING"));

    // Update appointment amounts and status if divergent
    if (
      apt.paidAmount !== calculatedPaid ||
      apt.dueAmount !== calculatedDue ||
      apt.paymentStatus !== resolvedStatus
    ) {
      await prisma.appointment.update({
        where: { id: apt.id },
        data: {
          paidAmount: calculatedPaid,
          dueAmount: calculatedDue,
          paymentStatus: resolvedStatus,
        },
      });
    }

    // 2. Sync care episode file (MedicalRecord) if linked
    const fileId = apt.medicalRecordId;
    if (fileId) {
      const fileApts = await prisma.appointment.findMany({
        where: {
          OR: [{ medicalRecordId: fileId }, { id: fileId }],
          status: { not: "CANCELLED" },
        },
        select: {
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
        },
      });

      let fileBill = 0;
      let filePaid = 0;
      let fileDue = 0;

      for (const a of fileApts) {
        const aFee = a.feeAmount ?? 0;
        const aIsPaid = a.paymentStatus === "PAID";
        const aPaid =
          a.paidAmount !== null && a.paidAmount !== undefined && (a.paidAmount > 0 || !aIsPaid)
            ? a.paidAmount
            : (aIsPaid ? aFee : 0);
        const aDue = aIsPaid
          ? 0
          : (a.dueAmount !== null && a.dueAmount !== undefined
              ? a.dueAmount
              : Math.max(0, aFee - aPaid));
        fileBill += aFee;
        filePaid += aPaid;
        fileDue += aDue;
      }

      await prisma.medicalRecord.update({
        where: { id: fileId },
        data: {
          totalBill: fileBill,
          totalPaid: filePaid,
          totalDue: fileDue,
        },
      });
    }

    // 3. Sync Patient lifetime billing totals
    if (apt.patientId) {
      await syncBillingForPatient(apt.patientId);
    }
  } catch (err) {
    console.error("[syncBillingForAppointment Error]:", err);
  }
}

/**
 * Synchronizes lifetime totalBill, totalPaid, totalDue on the Patient record
 * across all therapy sessions AND doctor consultation serials.
 */
export async function syncBillingForPatient(patientId: string): Promise<void> {
  try {
    const [therapyApts, serials, duePayments] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          patientId,
          status: { not: "CANCELLED" },
          OR: [
            { type: "THERAPY" },
            { therapySlotId: { not: null } },
          ],
        },
        select: {
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
        },
      }),
      prisma.consultationSerial.findMany({
        where: {
          patientId,
          status: { not: "CANCELLED" },
        },
        select: {
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
        },
      }),
      prisma.patientPayment.findMany({
        where: {
          patientId,
          serviceType: "PREVIOUS_DUE",
          isDue: false,
        },
        select: {
          amount: true,
        },
      }),
    ]);

    let patientBill = 0;
    let patientPaid = 0;

    for (const a of therapyApts) {
      const aFee = a.feeAmount ?? 0;
      const aIsPaid = a.paymentStatus === "PAID";
      const aPaid =
        a.paidAmount !== null && a.paidAmount !== undefined && (a.paidAmount > 0 || !aIsPaid)
          ? a.paidAmount
          : (aIsPaid ? aFee : 0);
      patientBill += aFee;
      patientPaid += aPaid;
    }

    for (const s of serials) {
      const sFee = s.feeAmount ?? 0;
      const sIsPaid = s.paymentStatus === "PAID";
      const sPaid =
        s.paidAmount !== null && s.paidAmount !== undefined && (s.paidAmount > 0 || !sIsPaid)
          ? s.paidAmount
          : (sIsPaid ? sFee : 0);
      patientBill += sFee;
      patientPaid += sPaid;
    }

    for (const dp of duePayments) {
      patientPaid += dp.amount || 0;
    }

    const patientDue = Math.max(0, patientBill - patientPaid);

    await prisma.patient.update({
      where: { id: patientId },
      data: {
        totalBill: patientBill,
        totalPaid: patientPaid,
        totalDue: patientDue,
      },
    });
  } catch (err) {
    console.error("[syncBillingForPatient Error]:", err);
  }
}
