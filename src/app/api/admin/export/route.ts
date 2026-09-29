import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

function parseDateRange(searchParams: URLSearchParams) {
  const preset = searchParams.get("preset");
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");

  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startParam && endParam) {
    startDate = new Date(`${startParam}T00:00:00.000+06:00`);
    endDate = new Date(`${endParam}T23:59:59.999+06:00`);
  } else if (preset === "today") {
    const todayStr = now.toISOString().slice(0, 10);
    startDate = new Date(`${todayStr}T00:00:00.000+06:00`);
    endDate = new Date(`${todayStr}T23:59:59.999+06:00`);
  } else if (preset === "yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    startDate = new Date(`${yestStr}T00:00:00.000+06:00`);
    endDate = new Date(`${yestStr}T23:59:59.999+06:00`);
  } else if (preset === "this_week") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startDate = new Date(`${startOfWeek.toISOString().slice(0, 10)}T00:00:00.000+06:00`);
    endDate = new Date(`${now.toISOString().slice(0, 10)}T23:59:59.999+06:00`);
  } else if (preset === "this_month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = new Date(`${startOfMonth.toISOString().slice(0, 10)}T00:00:00.000+06:00`);
    endDate = new Date(`${now.toISOString().slice(0, 10)}T23:59:59.999+06:00`);
  } else if (preset === "last_month") {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    startDate = new Date(`${startOfLastMonth.toISOString().slice(0, 10)}T00:00:00.000+06:00`);
    endDate = new Date(`${endOfLastMonth.toISOString().slice(0, 10)}T23:59:59.999+06:00`);
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    const sessionData = await getCurrentSession();
    if (!sessionData || sessionData.user.role !== Role.ADMIN) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("type") || "all";
    const { startDate, endDate } = parseDateRange(searchParams);

    const dateFilterClause = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
    const dateLabel = startDate && endDate
      ? `${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}`
      : "all_time";

    let csvContent = "";
    let filename = `HPC_Report_${exportType.toUpperCase()}_${dateLabel}.csv`;

    if (exportType === "all" || exportType === "comprehensive") {
      // MASTER COMPREHENSIVE FINANCIAL & CLINICAL TRANSACTION REPORT
      const appointments = await prisma.appointment.findMany({
        where: dateFilterClause ? { appointmentDate: dateFilterClause } : undefined,
        orderBy: { appointmentDate: "desc" },
        include: {
          patient: true,
          therapySlot: true,
          room: true,
          doctor: true,
          performer: true,
          bookedBy: true,
        },
      });

      const headers = [
        "Voucher No",
        "Appointment Date",
        "Told Time",
        "Token Serial",
        "Patient MRN",
        "Patient Name",
        "Phone Number",
        "Gender",
        "Age",
        "Address",
        "Service Type",
        "Slot / Modality",
        "Room / Chamber",
        "Assigned Doctor",
        "Handler / Therapist",
        "Booked By Performer",
        "Booking Category",
        "Appointment Status",
        "Payment Status",
        "Payment Mode",
        "Total Fee (BDT)",
        "Paid Amount (BDT)",
        "Due Balance (BDT)",
        "Clinical Notes",
      ];

      const rows = appointments.map((a) => [
        `HPC-REC-${a.id.slice(-6).toUpperCase()}`,
        a.appointmentDate.toISOString().slice(0, 10),
        a.toldTime || "",
        `#${a.id.slice(-4).toUpperCase()}`,
        a.patient?.mrn || "",
        a.patient?.name || "",
        a.patient?.phone || "",
        a.gender || a.patient?.gender || "",
        a.patient?.age ?? "",
        a.patient?.address || "",
        a.type === "CONSULTATION" ? "Doctor Consultation" : "Physiotherapy Session",
        a.therapySlot?.label || "Clinical Evaluation",
        a.room?.number || "",
        a.doctor?.name || "N/A",
        a.performer?.name || "N/A",
        a.bookedBy?.name || "System",
        a.bookingType,
        a.status,
        a.paymentStatus,
        a.paymentMethod || "CASH",
        a.feeAmount ?? 0,
        a.paidAmount ?? 0,
        a.dueAmount ?? 0,
        a.notes || "",
      ]);

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");

    } else if (exportType === "payments") {
      // DETAILED PAYMENTS & CASHIER LEDGER REPORT
      const appointments = await prisma.appointment.findMany({
        where: dateFilterClause ? { appointmentDate: dateFilterClause } : undefined,
        orderBy: { appointmentDate: "desc" },
        include: {
          patient: true,
          doctor: true,
          performer: true,
          bookedBy: true,
          therapySlot: true,
        },
      });

      const headers = [
        "Receipt No",
        "Date",
        "Patient MRN",
        "Patient Name",
        "Phone",
        "Service Description",
        "Payment Mode",
        "Payment Status",
        "Total Bill (BDT)",
        "Amount Received (BDT)",
        "Due Amount (BDT)",
        "Attending Doctor/Specialist",
        "Therapy Performer",
        "Booked By",
      ];

      const rows = appointments.map((a) => [
        `HPC-REC-${a.id.slice(-6).toUpperCase()}`,
        a.appointmentDate.toISOString().slice(0, 10),
        a.patient?.mrn || "",
        a.patient?.name || "",
        a.patient?.phone || "",
        a.type === "CONSULTATION" ? "Doctor Consultation" : (a.therapySlot?.label || "Physiotherapy"),
        a.paymentMethod || "CASH",
        a.paymentStatus,
        a.feeAmount ?? 0,
        a.paidAmount ?? 0,
        a.dueAmount ?? 0,
        a.doctor?.name || "N/A",
        a.performer?.name || "N/A",
        a.bookedBy?.name || "Front Desk",
      ]);

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");

    } else if (exportType === "patients") {
      // PATIENT DIRECTORY & LEDGER SUMMARY
      const patients = await prisma.patient.findMany({
        where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { appointments: true, medicalRecords: true },
          },
        },
      });

      const headers = [
        "Patient MRN",
        "Full Name",
        "Phone Number",
        "Gender",
        "Age",
        "Address",
        "Lifetime Total Bill (BDT)",
        "Lifetime Total Paid (BDT)",
        "Current Outstanding Due (BDT)",
        "Total Appointments",
        "Medical Records Count",
        "Registration Date",
      ];

      const rows = patients.map((p) => [
        p.mrn || "",
        p.name,
        p.phone,
        p.gender,
        p.age ?? "",
        p.address || "",
        p.totalBill,
        p.totalPaid,
        p.totalDue,
        p._count.appointments,
        p._count.medicalRecords,
        p.createdAt.toISOString().slice(0, 10),
      ]);

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");

    } else if (exportType === "appointments") {
      // APPOINTMENTS & QUEUE LOGS
      const appointments = await prisma.appointment.findMany({
        where: dateFilterClause ? { appointmentDate: dateFilterClause } : undefined,
        orderBy: { appointmentDate: "desc" },
        include: {
          patient: true,
          therapySlot: true,
          room: true,
          doctor: true,
          bookedBy: true,
        },
      });

      const headers = [
        "Appointment ID",
        "Date",
        "Token No",
        "Patient MRN",
        "Patient Name",
        "Phone",
        "Type",
        "Booking Type",
        "Slot / Description",
        "Room",
        "Doctor",
        "Status",
        "Payment Status",
        "Fee Amount",
        "Paid Amount",
        "Due Amount",
        "Booked By",
      ];

      const rows = appointments.map((a) => [
        a.id,
        a.appointmentDate.toISOString().slice(0, 10),
        `#${a.id.slice(-4).toUpperCase()}`,
        a.patient?.mrn || "",
        a.patient?.name || "",
        a.patient?.phone || "",
        a.type,
        a.bookingType,
        a.therapySlot?.label || "Consultation",
        a.room?.number || "",
        a.doctor?.name || "N/A",
        a.status,
        a.paymentStatus,
        a.feeAmount ?? 0,
        a.paidAmount ?? 0,
        a.dueAmount ?? 0,
        a.bookedBy?.name || "System",
      ]);

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");

    } else if (exportType === "audit") {
      // AUDIT & SECURITY LOGS
      const logs = await prisma.auditLog.findMany({
        where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
        take: 2000,
        orderBy: { createdAt: "desc" },
        include: { user: true, performer: true },
      });

      const headers = [
        "Log ID",
        "Timestamp",
        "Action",
        "Status",
        "User Role",
        "Performer Name",
        "Entity",
        "Entity ID",
        "IP Address",
        "Details",
      ];

      const rows = logs.map((l) => [
        l.id,
        l.createdAt.toISOString(),
        l.action,
        l.status,
        l.user?.role || "",
        l.performer?.name || "",
        l.entity || "",
        l.entityId || "",
        l.ipAddress || "",
        l.details || "",
      ]);

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");
    }

    // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows parses Bengali characters without corrupting
    return new NextResponse("\uFEFF" + csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[CSV Export Error]:", error);
    return new NextResponse("Failed to export CSV report", { status: 500 });
  }
}
