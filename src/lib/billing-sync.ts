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
    const calculatedPaid = isPaid ? fee : (apt.paidAmount ?? 0);
    const calculatedDue = isPaid ? 0 : Math.max(0, fee - calculatedPaid);

    // Update appointment amounts if divergent
    if (apt.paidAmount !== calculatedPaid || apt.dueAmount !== calculatedDue) {
      await prisma.appointment.update({
        where: { id: apt.id },
        data: {
          paidAmount: calculatedPaid,
          dueAmount: calculatedDue,
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
        const aPaid = a.paymentStatus === "PAID" ? aFee : (a.paidAmount ?? 0);
        fileBill += aFee;
        filePaid += aPaid;
        fileDue += a.paymentStatus === "PAID" ? 0 : Math.max(0, aFee - aPaid);
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
      const patientApts = await prisma.appointment.findMany({
        where: {
          patientId: apt.patientId,
          status: { not: "CANCELLED" },
        },
        select: {
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
        },
      });

      let patientBill = 0;
      let patientPaid = 0;
      let patientDue = 0;

      for (const a of patientApts) {
        const aFee = a.feeAmount ?? 0;
        const aPaid = a.paymentStatus === "PAID" ? aFee : (a.paidAmount ?? 0);
        patientBill += aFee;
        patientPaid += aPaid;
        patientDue += a.paymentStatus === "PAID" ? 0 : Math.max(0, aFee - aPaid);
      }

      await prisma.patient.update({
        where: { id: apt.patientId },
        data: {
          totalBill: patientBill,
          totalPaid: patientPaid,
          totalDue: patientDue,
        },
      });
    }
  } catch (err) {
    console.error("[syncBillingForAppointment Error]:", err);
  }
}
