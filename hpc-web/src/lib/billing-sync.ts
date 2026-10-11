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
        status: true,
        invoiceId: true,
        medicalRecordId: true,
      },
    });

    if (!apt) return;

    // Cancelled appointments should never carry PAID status or due amounts
    if (apt.status === "CANCELLED") {
      if (apt.paymentStatus !== "CANCELLED" || apt.dueAmount !== 0) {
        await prisma.appointment.update({
          where: { id: apt.id },
          data: {
            paymentStatus: "CANCELLED",
            dueAmount: 0,
          },
        });
      }
      return;
    }

    const fee = apt.feeAmount ?? 0;
    const hasInvoiceOrCash = Boolean(apt.invoiceId || (apt.paidAmount ?? 0) > 0);
    const isPaid = apt.paymentStatus === "PAID" && (fee > 0 || hasInvoiceOrCash);
    const rawPaid =
      apt.paidAmount !== null && apt.paidAmount !== undefined && (apt.paidAmount > 0 || !isPaid)
        ? apt.paidAmount
        : (isPaid ? fee : 0);
    const calculatedPaid = Math.max(0, rawPaid);
    const calculatedDue = isPaid ? 0 : Math.max(0, fee - calculatedPaid);
    const resolvedStatus =
      fee > 0
        ? (calculatedDue === 0 ? "PAID" : (calculatedPaid > 0 ? "PARTIAL" : (apt.paymentStatus || "PENDING")))
        : (hasInvoiceOrCash ? "PAID" : (apt.paymentStatus || "PENDING"));

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
 * accurately across all invoices, therapy sessions, and doctor consultation serials.
 */
export async function syncBillingForPatient(patientId: string): Promise<void> {
  try {
    const [dueInvoices, uninvoicedSerials, uninvoicedCompletedApts, payments, allTherapyApts, allSerials] =
      await Promise.all([
        // 1. Outstanding due on issued invoices
        prisma.patientInvoice.findMany({
          where: {
            patientId,
            dueAmount: { gt: 0 },
            status: { in: ["DUE", "PARTIAL"] },
          },
          select: { dueAmount: true },
        }),

        // 2. Uninvoiced consultation serials with due balance
        prisma.consultationSerial.findMany({
          where: {
            patientId,
            invoiceId: null,
            status: { not: "CANCELLED" },
            OR: [
              { paymentStatus: "DUE" },
              { paymentStatus: "PARTIAL" },
              { dueAmount: { gt: 0 } },
            ],
          },
          select: { feeAmount: true, paidAmount: true, dueAmount: true },
        }),

        // 3. Uninvoiced completed appointments with due balance
        prisma.appointment.findMany({
          where: {
            patientId,
            invoiceId: null,
            status: "COMPLETED",
            OR: [
              { paymentStatus: "DUE" },
              { paymentStatus: "PARTIAL" },
              { dueAmount: { gt: 0 } },
            ],
          },
          select: { feeAmount: true, paidAmount: true, dueAmount: true },
        }),

        // 4. All successful patient payments
        prisma.patientPayment.findMany({
          where: {
            patientId,
            isDue: false,
          },
          select: { amount: true },
        }),

        // 5. All active therapy appointments
        prisma.appointment.findMany({
          where: {
            patientId,
            status: { not: "CANCELLED" },
            OR: [
              { type: "THERAPY" },
              { therapySlotId: { not: null } },
              { therapyFee: { gt: 0 } },
            ],
          },
          select: { feeAmount: true, therapyFee: true, paidAmount: true, paymentStatus: true },
        }),

        // 6. All active consultation serials
        prisma.consultationSerial.findMany({
          where: {
            patientId,
            status: { not: "CANCELLED" },
          },
          select: { feeAmount: true, paidAmount: true, paymentStatus: true },
        }),
      ]);

    // Compute true unpaid due
    let invoicedDue = 0;
    for (const inv of dueInvoices) {
      invoicedDue += inv.dueAmount;
    }

    let serialsDue = 0;
    for (const s of uninvoicedSerials) {
      const sDue = s.dueAmount > 0 ? s.dueAmount : Math.max(0, s.feeAmount - s.paidAmount);
      serialsDue += sDue;
    }

    let aptsDue = 0;
    for (const a of uninvoicedCompletedApts) {
      const aDue = (a.dueAmount ?? 0) > 0 ? (a.dueAmount ?? 0) : Math.max(0, (a.feeAmount ?? 0) - (a.paidAmount ?? 0));
      aptsDue += aDue;
    }

    const patientDue = Math.max(0, invoicedDue + serialsDue + aptsDue);

    // Compute actual collections
    let paymentRecordsSum = 0;
    for (const p of payments) {
      paymentRecordsSum += p.amount || 0;
    }

    let fallbackPaid = 0;
    for (const a of allTherapyApts) {
      const aFee = a.therapyFee ?? a.feeAmount ?? 0;
      const aIsPaid = a.paymentStatus === "PAID";
      fallbackPaid += a.paidAmount !== null && a.paidAmount !== undefined && (a.paidAmount > 0 || !aIsPaid)
        ? a.paidAmount
        : (aIsPaid ? aFee : 0);
    }
    for (const s of allSerials) {
      const sFee = s.feeAmount ?? 0;
      const sIsPaid = s.paymentStatus === "PAID";
      fallbackPaid += s.paidAmount !== null && s.paidAmount !== undefined && (s.paidAmount > 0 || !sIsPaid)
        ? s.paidAmount
        : (sIsPaid ? sFee : 0);
    }

    const patientPaid = paymentRecordsSum > 0 ? paymentRecordsSum : fallbackPaid;

    // Compute total billed services
    let servicesBill = 0;
    for (const a of allTherapyApts) {
      servicesBill += a.therapyFee ?? a.feeAmount ?? 0;
    }
    for (const s of allSerials) {
      servicesBill += s.feeAmount ?? 0;
    }

    const patientBill = Math.max(servicesBill, patientPaid + patientDue);

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

/**
 * Automatically clears previous unpaid dues (FIFO) when a previous due payment is recorded.
 * Deducts collected due amount from prior unpaid/partial invoices, consultation serials, and appointments.
 */
export async function clearPreviousDuesForPatient(
  patientId: string,
  amountToClear: number,
  clearingInvoiceId?: string,
): Promise<void> {
  if (amountToClear <= 0) return;
  try {
    let remaining = amountToClear;

    // 1. Find all previous invoices with due balances in FIFO order (oldest first)
    const dueInvoices = await prisma.patientInvoice.findMany({
      where: {
        patientId,
        dueAmount: { gt: 0 },
        ...(clearingInvoiceId ? { id: { not: clearingInvoiceId } } : {}),
      },
      include: {
        consultationSerials: true,
        appointments: true,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const inv of dueInvoices) {
      if (remaining <= 0) break;
      const deduction = Math.min(remaining, inv.dueAmount);
      const newDue = Math.max(0, inv.dueAmount - deduction);
      const newPaid = inv.paidAmount + deduction;
      const newStatus = newDue === 0 ? "PAID" : "PARTIAL";

      await prisma.patientInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        },
      });

      // Update linked consultation serials
      for (const serial of inv.consultationSerials) {
        if ((serial.dueAmount ?? 0) > 0) {
          const sDeduct = Math.min(deduction, serial.dueAmount);
          const sNewDue = Math.max(0, serial.dueAmount - sDeduct);
          const sNewPaid = (serial.paidAmount ?? 0) + sDeduct;
          await prisma.consultationSerial.update({
            where: { id: serial.id },
            data: {
              paidAmount: sNewPaid,
              dueAmount: sNewDue,
              paymentStatus: sNewDue === 0 ? "PAID" : "PARTIAL",
            },
          });
        }
      }

      // Update linked appointments
      for (const apt of inv.appointments) {
        if ((apt.dueAmount ?? 0) > 0) {
          const aDeduct = Math.min(deduction, apt.dueAmount ?? 0);
          const aNewDue = Math.max(0, (apt.dueAmount ?? 0) - aDeduct);
          const aNewPaid = (apt.paidAmount ?? 0) + aDeduct;
          await prisma.appointment.update({
            where: { id: apt.id },
            data: {
              paidAmount: aNewPaid,
              dueAmount: aNewDue,
              paymentStatus: aNewDue === 0 ? "PAID" : "PARTIAL",
            },
          });
        }
      }

      remaining -= deduction;
    }

    // 2. If remaining, clear uninvoiced consultation serials with due
    if (remaining > 0) {
      const dueSerials = await prisma.consultationSerial.findMany({
        where: {
          patientId,
          invoiceId: null,
          dueAmount: { gt: 0 },
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "asc" },
      });

      for (const s of dueSerials) {
        if (remaining <= 0) break;
        const sDeduct = Math.min(remaining, s.dueAmount);
        const sNewDue = Math.max(0, s.dueAmount - sDeduct);
        const sNewPaid = (s.paidAmount ?? 0) + sDeduct;
        await prisma.consultationSerial.update({
          where: { id: s.id },
          data: {
            paidAmount: sNewPaid,
            dueAmount: sNewDue,
            paymentStatus: sNewDue === 0 ? "PAID" : "PARTIAL",
          },
        });
        remaining -= sDeduct;
      }
    }

    // 3. If remaining, clear uninvoiced appointments with due
    if (remaining > 0) {
      const dueApts = await prisma.appointment.findMany({
        where: {
          patientId,
          invoiceId: null,
          dueAmount: { gt: 0 },
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "asc" },
      });

      for (const a of dueApts) {
        if (remaining <= 0) break;
        const aDeduct = Math.min(remaining, a.dueAmount ?? 0);
        const aNewDue = Math.max(0, (a.dueAmount ?? 0) - aDeduct);
        const aNewPaid = (a.paidAmount ?? 0) + aDeduct;
        await prisma.appointment.update({
          where: { id: a.id },
          data: {
            paidAmount: aNewPaid,
            dueAmount: aNewDue,
            paymentStatus: aNewDue === 0 ? "PAID" : "PARTIAL",
          },
        });
        remaining -= aDeduct;
      }
    }

    // Re-sync patient lifetime totals
    await syncBillingForPatient(patientId);
  } catch (err) {
    console.error("[clearPreviousDuesForPatient Error]:", err);
  }
}

