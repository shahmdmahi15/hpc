import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, validateSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import {
  applyTitleBanner,
  applyHeaderStyle,
  applyDataRowStyles,
  autoFitColumns,
  addSummaryRow,
} from "@/lib/excel-export";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { getPatientCompleteHistoryData } from "@/actions/admin/patient-history.action";

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

function getAppointmentFinancials(a: {
  feeAmount?: number | null;
  paidAmount?: number | null;
  dueAmount?: number | null;
  paymentStatus?: string | null;
  invoice?: {
    totalAmount?: number | null;
    paidAmount?: number | null;
    dueAmount?: number | null;
    status?: string | null;
  } | null;
}) {
  if ((a.feeAmount ?? 0) === 0 && a.invoice) {
    const fee = a.invoice.totalAmount ?? 0;
    const paid = a.invoice.paidAmount ?? 0;
    const due = a.invoice.dueAmount ?? Math.max(0, fee - paid);
    return { fee, paid, due };
  }
  const fee = typeof a.feeAmount === "number" ? a.feeAmount : 0;
  const isPaid = a.paymentStatus === "PAID";
  const paid = isPaid ? fee : (typeof a.paidAmount === "number" ? a.paidAmount : 0);
  const due = isPaid ? 0 : Math.max(0, fee - paid);
  return { fee, paid, due };
}

function getAttendingDoctorName(a: {
  type?: string;
  doctor?: { name: string | null } | null;
  medicalFile?: { doctor?: { name: string | null } | null } | null;
  medicalRecords?: { doctor?: { name: string | null } | null }[];
  treatmentPlans?: { doctor?: { name: string | null } | null }[];
}): string {
  if (a.doctor?.name) return a.doctor.name;
  if (a.medicalFile?.doctor?.name) return a.medicalFile.doctor.name;
  if (a.medicalRecords?.[0]?.doctor?.name) return a.medicalRecords[0].doctor.name;
  if (a.treatmentPlans?.[0]?.doctor?.name) return a.treatmentPlans[0].doctor.name;
  if (a.type === "CONSULTATION") return "Dr. Farhan Ahmed, PT, DPT";
  return "N/A";
}

export async function GET(request: NextRequest) {
  try {
    let sessionData = await getCurrentSession();
    if (!sessionData) {
      const token =
        request.cookies.get(SESSION_COOKIE_NAME)?.value ||
        request.cookies.get("__Host-SESSION_TOKEN")?.value ||
        request.cookies.get("SESSION_TOKEN")?.value;
      if (token) {
        sessionData = await validateSessionToken(token);
      }
    }

    if (!sessionData || sessionData.user.role !== Role.ADMIN) {
      return new NextResponse("Unauthorized: Admin privileges required", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("type") || "all";
    const exportFormat = searchParams.get("format") || "xlsx"; // Default to Excel .xlsx
    const { startDate, endDate } = parseDateRange(searchParams);

    const dateFilterClause = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
    const dateLabel = startDate && endDate
      ? `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`
      : "All Historical Data";
    const filenameLabel = startDate && endDate
      ? `${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}`
      : "all_time";

    // ─────────────────────────────────────────────────────────────
    // 0. SPECIALIZED: INDIVIDUAL PATIENT COMPLETE MEDICAL & JOURNEY DOSSIER
    // ─────────────────────────────────────────────────────────────
    if (exportType === "patient_history") {
      const patientId = searchParams.get("patientId");
      if (!patientId) {
        return new NextResponse("Missing patientId parameter", { status: 400 });
      }

      let patientDataResult: any;
      try {
        patientDataResult = await getPatientCompleteHistoryData(patientId);
      } catch {
        return new NextResponse("Patient record not found", { status: 404 });
      }
      const patient = patientDataResult.patient;

      // JSON format
      if (exportFormat === "json") {
        const jsonContent = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            clinic: CLINIC_CONFIG,
            patient,
          },
          null,
          2
        );
        return new NextResponse(jsonContent, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="patient_${patient.mrn || patient.id}_history.json"`,
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }

      // Excel .xlsx multi-sheet dossier
      const workbook = new ExcelJS.Workbook();
      workbook.creator = `${CLINIC_CONFIG.name} Patient Dossier`;
      workbook.lastModifiedBy = sessionData.user.name || "System Admin";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Sheet 1: Patient Profile & Demographics
      const wsProfile = workbook.addWorksheet("Patient Profile", {
        views: [{ showGridLines: true }],
      });
      const pR = applyTitleBanner(
        wsProfile,
        `Patient Medical Dossier: ${patient.name} (${patient.mrn})`,
        CLINIC_CONFIG.tagline,
        "Master Patient History",
        6
      );

      wsProfile.mergeCells(pR, 1, pR, 6);
      const s1 = wsProfile.getRow(pR);
      s1.values = ["PATIENT MASTER IDENTIFICATION & DEMOGRAPHICS"];
      s1.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
      s1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
      s1.height = 24;

      const profileFields = [
        ["Patient Full Name", patient.name, "Medical Record No (MRN)", patient.mrn],
        ["Primary Contact Phone", patient.phone, "Gender / Sex", patient.gender],
        ["Blood Group", patient.bloodGroup || "Not Specified", "Date of Birth", patient.dateOfBirth || "N/A"],
        ["Emergency Contact", patient.emergencyPhone || patient.emergencyContact || "None Recorded", "Residential Address", patient.address || "None Recorded"],
        ["Total Lifetime Billed", patient.totalBill, "Total Collections Paid", patient.totalPaid],
        ["Current Outstanding Due", patient.totalDue, "Account Status", patient.totalDue > 0 ? "DUE BALANCE" : "SETTLED"],
        ["Registered Date", patient.createdAt.toISOString().slice(0, 10), "Last Profile Update", patient.updatedAt.toISOString().slice(0, 10)],
      ];

      profileFields.forEach((fields, idx) => {
        const row = wsProfile.getRow(pR + 1 + idx);
        row.values = [fields[0], fields[1], fields[2], fields[3]];
        row.height = 22;
        if (typeof fields[1] === "number") row.getCell(2).numFmt = '"৳" #,##0.00';
        if (typeof fields[3] === "number") row.getCell(4).numFmt = '"৳" #,##0.00';
      });

      applyHeaderStyle(wsProfile, pR + 1);
      autoFitColumns(wsProfile, 16, 40);

      // Sheet 2: Consultations
      const wsConsult = workbook.addWorksheet("Consultations", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
      });
      const cR = applyTitleBanner(
        wsConsult,
        `Doctor Consultations: ${patient.name}`,
        CLINIC_CONFIG.tagline,
        "Clinical Consultations",
        7
      );
      const consultHeaders = [
        "Date",
        "Token / Serial",
        "Attending Doctor",
        "Chamber / Room",
        "Service Category",
        "Appointment Status",
        "Clinical Notes",
      ];
      wsConsult.getRow(cR).values = consultHeaders;
      applyHeaderStyle(wsConsult, cR);
      patient.appointments
        .filter((a: any) => a.type === "CONSULTATION")
        .forEach((a: any, idx: number) => {
          const row = wsConsult.getRow(cR + 1 + idx);
          row.values = [
            a.appointmentDate.toISOString().slice(0, 10),
            a.serialNumber ? `#${a.serialNumber}` : `#${a.id.slice(-4).toUpperCase()}`,
            a.doctor?.name || "Dr. Assigned",
            a.room?.number ? `Room ${a.room.number}` : "Chamber",
            "Doctor Consultation",
            a.status,
            a.notes || "",
          ];
          row.height = 20;
        });
      autoFitColumns(wsConsult, 14, 40);

      // Sheet 3: Prescriptions & Medicines
      const wsRx = workbook.addWorksheet("Prescriptions", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
      });
      const rxR = applyTitleBanner(
        wsRx,
        `Prescriptions & Medications: ${patient.name}`,
        CLINIC_CONFIG.tagline,
        "Prescribed Medicines",
        8
      );
      const rxHeaders = [
        "Prescription Date",
        "Doctor",
        "Medicine Name",
        "Dosage",
        "Timing (M-A-N)",
        "Meal Timing",
        "Duration",
        "Special Instructions",
      ];
      wsRx.getRow(rxR).values = rxHeaders;
      applyHeaderStyle(wsRx, rxR);
      let rxRowCount = 0;
      patient.prescriptions.forEach((rx: any) => {
        let medicines: any[] = [];
        try {
          if (typeof rx.medicines === "string") medicines = JSON.parse(rx.medicines);
          else if (Array.isArray(rx.medicines)) medicines = rx.medicines;
        } catch {
          medicines = [];
        }
        if (medicines.length === 0) {
          rxRowCount++;
          const row = wsRx.getRow(rxR + rxRowCount);
          row.values = [
            rx.createdAt.toISOString().slice(0, 10),
            rx.doctor?.name || "Attending Doctor",
            "General Clinical Advice",
            "",
            "",
            "",
            "",
            rx.instructions || "",
          ];
          row.height = 20;
        } else {
          medicines.forEach((m) => {
            rxRowCount++;
            const row = wsRx.getRow(rxR + rxRowCount);
            const timingStr = [
              m.timing?.morning ? "Morn" : null,
              m.timing?.afternoon ? "Noon" : null,
              m.timing?.night ? "Night" : null,
            ]
              .filter(Boolean)
              .join(" + ") || "As directed";
            row.values = [
              rx.createdAt.toISOString().slice(0, 10),
              rx.doctor?.name || "Attending Doctor",
              m.name || "Medicine",
              m.dosage || "",
              timingStr,
              m.mealTiming === "BEFORE_MEAL" ? "Before Meal" : m.mealTiming === "AFTER_MEAL" ? "After Meal" : "",
              m.duration || "",
              m.instructions || rx.instructions || "",
            ];
            row.height = 20;
          });
        }
      });
      autoFitColumns(wsRx, 14, 40);

      // Sheet 4: Therapy Protocols
      const wsTherapy = workbook.addWorksheet("Therapy Protocols", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
      });
      const tR = applyTitleBanner(
        wsTherapy,
        `Physical Therapy & Modality Protocols: ${patient.name}`,
        CLINIC_CONFIG.tagline,
        "Therapy Protocols",
        7
      );
      const therapyHeaders = [
        "Plan Date",
        "Prescribed By Doctor",
        "Clinical Diagnosis",
        "Target Modalities",
        "Duration (Mins)",
        "Completed Sessions",
        "Status",
      ];
      wsTherapy.getRow(tR).values = therapyHeaders;
      applyHeaderStyle(wsTherapy, tR);
      patient.treatmentPlans.forEach((tp: any, idx: number) => {
        let modalities: any[] = [];
        try {
          if (typeof tp.modalities === "string") modalities = JSON.parse(tp.modalities);
          else if (Array.isArray(tp.modalities)) modalities = tp.modalities;
        } catch {
          modalities = [];
        }
        const row = wsTherapy.getRow(tR + 1 + idx);
        row.values = [
          tp.createdAt.toISOString().slice(0, 10),
          tp.doctor?.name || "Dr. Assigned",
          tp.diagnosis || "Physiotherapy Rehabilitation",
          modalities.map((m: any) => (typeof m === "string" ? m : m.name || m.label)).join(", ") || "General PT",
          tp.durationMinutes ?? 30,
          `${tp.completedDays || 0} / ${tp.totalDays || 1}`,
          tp.status || "ACTIVE",
        ];
        row.height = 20;
      });
      autoFitColumns(wsTherapy, 14, 40);

      // Sheet 5: Invoices & Ledger
      const wsInv = workbook.addWorksheet("Invoices & Ledger", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
      });
      const invR = applyTitleBanner(
        wsInv,
        `Itemized Billing & Payments Ledger: ${patient.name}`,
        CLINIC_CONFIG.tagline,
        "Financial Ledger",
        7
      );
      const invHeaders = [
        "Invoice Number",
        "Created Date",
        "Total Billed (BDT)",
        "Paid Amount (BDT)",
        "Outstanding Due (BDT)",
        "Invoice Status",
        "Notes / Remarks",
      ];
      wsInv.getRow(invR).values = invHeaders;
      applyHeaderStyle(wsInv, invR);
      patient.invoices.forEach((inv: any, idx: number) => {
        const row = wsInv.getRow(invR + 1 + idx);
        row.values = [
          inv.invoiceNumber,
          inv.createdAt.toISOString().slice(0, 10),
          inv.totalAmount,
          inv.paidAmount,
          inv.dueAmount,
          inv.status,
          inv.notes || "",
        ];
        row.height = 20;
        row.getCell(3).numFmt = '"৳" #,##0.00';
        row.getCell(4).numFmt = '"৳" #,##0.00';
        row.getCell(5).numFmt = '"৳" #,##0.00';
      });
      autoFitColumns(wsInv, 14, 35);

      // Sheet 6: Station Journey & Audit Trail
      const wsJourney = workbook.addWorksheet("Station Journey", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
      });
      const jR = applyTitleBanner(
        wsJourney,
        `Patient Station Journey Audit Trail: ${patient.name}`,
        CLINIC_CONFIG.tagline,
        "Station Journey",
        6
      );
      const journeyHeaders = [
        "Step #",
        "Timestamp",
        "Station / Stage",
        "Room / Chamber",
        "Staff / Performer",
        "Activity Notes",
      ];
      wsJourney.getRow(jR).values = journeyHeaders;
      applyHeaderStyle(wsJourney, jR);
      patient.stepLogs.forEach((step: any, idx: number) => {
        const row = wsJourney.getRow(jR + 1 + idx);
        row.values = [
          idx + 1,
          step.timestamp ? new Date(step.timestamp).toISOString().replace("T", " ").slice(0, 19) : "",
          step.station,
          step.roomNumber ? `Room ${step.roomNumber}` : "Main Center",
          step.performerId || "HPC Staff",
          step.details || "",
        ];
        row.height = 20;
      });
      autoFitColumns(wsJourney, 14, 35);

      const buffer = await workbook.xlsx.writeBuffer();
      const nodeBuffer = Buffer.from(buffer);
      const filename = `HPC_Patient_${patient.mrn || patient.id}_Complete_History.xlsx`;

      return new NextResponse(nodeBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": nodeBuffer.length.toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 0.1 GENERAL JSON EXPORT (WHEN FORMAT === "JSON")
    // ─────────────────────────────────────────────────────────────
    if (exportFormat === "json") {
      let jsonData: any = {};
      if (exportType === "patients") {
        const patients = await prisma.patient.findMany({
          where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { appointments: true, medicalRecords: true } } },
        });
        jsonData = { exportType, exportedAt: new Date().toISOString(), count: patients.length, patients };
      } else if (exportType === "appointments") {
        const appointments = await prisma.appointment.findMany({
          where: dateFilterClause ? { appointmentDate: dateFilterClause } : undefined,
          orderBy: { appointmentDate: "desc" },
          include: { patient: true, therapySlot: true, room: true, doctor: true, performer: true, invoice: true },
        });
        jsonData = { exportType, exportedAt: new Date().toISOString(), count: appointments.length, appointments };
      } else if (exportType === "payments" || exportType === "invoices") {
        const invoices = await prisma.patientInvoice.findMany({
          where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
          orderBy: { createdAt: "desc" },
          include: { patient: true, payments: true },
        });
        jsonData = { exportType, exportedAt: new Date().toISOString(), count: invoices.length, invoices };
      } else if (exportType === "audit") {
        const logs = await prisma.auditLog.findMany({
          where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
          take: 3000,
          orderBy: { createdAt: "desc" },
          include: { user: true, performer: true },
        });
        jsonData = { exportType, exportedAt: new Date().toISOString(), count: logs.length, auditLogs: logs };
      } else {
        const [patients, appointments, invoices, auditLogs] = await Promise.all([
          prisma.patient.findMany({
            where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
            orderBy: { createdAt: "desc" },
            take: 1000,
          }),
          prisma.appointment.findMany({
            where: dateFilterClause ? { appointmentDate: dateFilterClause } : undefined,
            orderBy: { appointmentDate: "desc" },
            include: { patient: true, therapySlot: true, room: true, doctor: true },
            take: 2000,
          }),
          prisma.patientInvoice.findMany({
            where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
            orderBy: { createdAt: "desc" },
            include: { payments: true },
            take: 2000,
          }),
          prisma.auditLog.findMany({
            where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
            orderBy: { createdAt: "desc" },
            take: 1000,
          }),
        ]);
        jsonData = {
          exportType: "all",
          exportedAt: new Date().toISOString(),
          clinic: CLINIC_CONFIG,
          patients,
          appointments,
          invoices,
          auditLogs,
        };
      }

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="HPC_${exportType}_${filenameLabel}.json"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 1. EXCEL WORKBOOK (.XLSX) MULTI-SHEET GENERATOR
    // ─────────────────────────────────────────────────────────────
    if (exportFormat === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = `${CLINIC_CONFIG.name} Management System`;
      workbook.lastModifiedBy = sessionData.user.name || "System Admin";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Query data
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
          invoice: true,
          medicalFile: { include: { doctor: true } },
          medicalRecords: { include: { doctor: true } },
          treatmentPlans: { include: { doctor: true } },
        },
      });

      const patients = await prisma.patient.findMany({
        where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { appointments: true, medicalRecords: true },
          },
        },
      });

      const auditLogs = await prisma.auditLog.findMany({
        where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
        take: 3000,
        orderBy: { createdAt: "desc" },
        include: { user: true, performer: true },
      });

      // ───────────────────────────────────────────────────────────
      // SHEET 1: EXECUTIVE OVERVIEW & KPI DASHBOARD
      // ───────────────────────────────────────────────────────────
      if (exportType === "all" || exportType === "summary") {
        const wsSummary = workbook.addWorksheet("Executive Summary", {
          views: [{ showGridLines: true }],
        });

        const startR = applyTitleBanner(
          wsSummary,
          "Executive Management & Financial Closing Dashboard",
          CLINIC_CONFIG.tagline,
          dateLabel,
          8
        );

        // Calculate KPI Metrics
        const totalVisits = appointments.length;
        const consultCount = appointments.filter((a) => a.type === "CONSULTATION").length;
        const therapyCount = appointments.filter((a) => a.type === "THERAPY").length;
        const totalBilled = appointments.reduce((sum, a) => sum + getAppointmentFinancials(a).fee, 0);
        const totalCollected = appointments.reduce((sum, a) => sum + getAppointmentFinancials(a).paid, 0);
        const totalDue = appointments.reduce((sum, a) => sum + getAppointmentFinancials(a).due, 0);
        const getPayMethod = (a: (typeof appointments)[number]) =>
          a.paymentMethod || a.invoice?.paymentMethod || "CASH";
        const cashTotal = appointments
          .filter((a) => getPayMethod(a) === "CASH")
          .reduce((sum, a) => sum + getAppointmentFinancials(a).paid, 0);
        const cardTotal = appointments
          .filter((a) => getPayMethod(a) === "CARD")
          .reduce((sum, a) => sum + getAppointmentFinancials(a).paid, 0);
        const mfsTotal = appointments
          .filter((a) => getPayMethod(a) === "MFS" || getPayMethod(a) === "BKASH" || getPayMethod(a) === "NAGAD")
          .reduce((sum, a) => sum + getAppointmentFinancials(a).paid, 0);

        // Section Title
        wsSummary.mergeCells(startR, 1, startR, 8);
        const sec1 = wsSummary.getRow(startR);
        sec1.values = ["CLINICAL & FINANCIAL KEY PERFORMANCE INDICATORS (KPI)"];
        sec1.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
        sec1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
        sec1.alignment = { vertical: "middle", horizontal: "left" };
        sec1.height = 24;

        // Metric Table Header
        const kpiHeaderRow = startR + 1;
        wsSummary.getRow(kpiHeaderRow).values = [
          "Metric Indicator",
          "Recorded Value",
          "Metric Unit",
          "",
          "Payment Channel",
          "Settled Amount",
          "Channel Share (%)",
          "",
        ];
        applyHeaderStyle(wsSummary, kpiHeaderRow);

        // Data Rows
        const kpiRows = [
          ["Total Patient Visits & Bookings", totalVisits, "Visits", "", "Cash Desk Collections", cashTotal, totalCollected > 0 ? (cashTotal / totalCollected) : 0],
          ["Doctor Consultations Completed", consultCount, "Consultations", "", "Digital MFS (bKash/Nagad)", mfsTotal, totalCollected > 0 ? (mfsTotal / totalCollected) : 0],
          ["Physical Therapy Sessions", therapyCount, "Sessions", "", "Debit / Credit POS Card", cardTotal, totalCollected > 0 ? (cardTotal / totalCollected) : 0],
          ["Gross Billed Revenue Value", totalBilled, "BDT (৳)", "", "Total Collections Settled", totalCollected, 1],
          ["Net Cash & Bank Collections", totalCollected, "BDT (৳)", "", "Outstanding Patient Dues", totalDue, totalBilled > 0 ? (totalDue / totalBilled) : 0],
          ["Outstanding Patient Due Balance", totalDue, "BDT (৳)", "", "Unique Registered Patients", patients.length, "-"],
        ];

        kpiRows.forEach((r, idx) => {
          const rowNum = kpiHeaderRow + 1 + idx;
          const row = wsSummary.getRow(rowNum);
          row.values = r;
          row.height = 22;
          row.getCell(2).numFmt = typeof r[1] === "number" && r[1] > 100 ? '"৳" #,##0.00' : '#,##0';
          row.getCell(6).numFmt = typeof r[5] === "number" ? '"৳" #,##0.00' : '@';
          row.getCell(7).numFmt = typeof r[6] === "number" ? '0.0%' : '@';
        });

        applyDataRowStyles(wsSummary, kpiHeaderRow + 1, kpiHeaderRow + kpiRows.length, {
          1: "left",
          2: "right",
          3: "center",
          5: "left",
          6: "right",
          7: "right",
        });

        autoFitColumns(wsSummary, 16, 42);
      }

      // ───────────────────────────────────────────────────────────
      // SHEET 2: BILLING & COLLECTIONS LEDGER
      // ───────────────────────────────────────────────────────────
      if (exportType === "all" || exportType === "payments" || exportType === "invoices") {
        const wsBilling = workbook.addWorksheet("Billing & Collections", {
          views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
        });

        const headerStart = applyTitleBanner(
          wsBilling,
          "Comprehensive Billing & Collections Transaction Ledger",
          "Itemized Clinical Cash Memos & Invoices",
          dateLabel,
          17
        );

        const headers = [
          "Voucher No",
          "Date",
          "Time",
          "Token Serial",
          "Patient MRN",
          "Patient Name",
          "Contact Phone",
          "Service Category",
          "Modality / Slot",
          "Room",
          "Attending Doctor",
          "Therapy Performer",
          "Booked By",
          "Payment Method",
          "Billing Status",
          "Gross Fee (BDT)",
          "Paid Amount (BDT)",
          "Due Balance (BDT)",
        ];

        wsBilling.getRow(headerStart).values = headers;
        applyHeaderStyle(wsBilling, headerStart);

        const dataStart = headerStart + 1;
        appointments.forEach((a, idx) => {
          const rNum = dataStart + idx;
          const row = wsBilling.getRow(rNum);
          row.values = [
            `HPC-REC-${a.id.slice(-6).toUpperCase()}`,
            a.appointmentDate.toISOString().slice(0, 10),
            a.toldTime || a.willCallTime || "",
            `#${a.id.slice(-4).toUpperCase()}`,
            a.patient?.mrn || "",
            a.patient?.name || "",
            a.patient?.phone || "",
            a.type === "CONSULTATION" ? "Doctor Consultation" : "Physiotherapy",
            a.therapySlot?.label || "Clinical Evaluation",
            a.room?.number ? `Room ${a.room.number}` : "Chamber",
            getAttendingDoctorName(a),
            a.performer?.name || "N/A",
            a.bookedBy?.name || "Reception Desk",
            a.paymentMethod || "CASH",
            a.paymentStatus,
            getAppointmentFinancials(a).fee,
            getAppointmentFinancials(a).paid,
            getAppointmentFinancials(a).due,
          ];
        });

        const dataEnd = dataStart + appointments.length - 1;
        if (appointments.length > 0) {
          applyDataRowStyles(
            wsBilling,
            dataStart,
            dataEnd,
            {
              1: "center",
              2: "center",
              3: "center",
              4: "center",
              5: "center",
              6: "left",
              7: "center",
              8: "left",
              9: "left",
              10: "center",
              11: "left",
              12: "left",
              13: "left",
              14: "center",
              15: "center",
              16: "right",
              17: "right",
              18: "right",
            },
            {
              16: '"৳" #,##0.00',
              17: '"৳" #,##0.00',
              18: '"৳" #,##0.00',
            }
          );

          // Add SUM formula totals row
          addSummaryRow(
            wsBilling,
            dataEnd + 1,
            "TOTAL REVENUE & COLLECTIONS SUMMARY:",
            dataStart,
            dataEnd,
            [16, 17, 18]
          );
        }

        autoFitColumns(wsBilling, 12, 38);
      }

      // ───────────────────────────────────────────────────────────
      // SHEET 3: PATIENT DIRECTORY & DEMOGRAPHICS
      // ───────────────────────────────────────────────────────────
      if (exportType === "all" || exportType === "patients") {
        const wsPatients = workbook.addWorksheet("Patient Directory", {
          views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
        });

        const headerStart = applyTitleBanner(
          wsPatients,
          "Registered Patient Directory & Ledger Summary",
          "Master Patient Demographics & Financial Balances",
          dateLabel,
          12
        );

        const headers = [
          "Patient MRN",
          "Full Name",
          "Phone Number",
          "Gender",
          "Age (Yrs)",
          "Residential Address",
          "Registration Date",
          "Total Appointments",
          "Medical Records",
          "Lifetime Total Bill (BDT)",
          "Lifetime Total Paid (BDT)",
          "Outstanding Due (BDT)",
        ];

        wsPatients.getRow(headerStart).values = headers;
        applyHeaderStyle(wsPatients, headerStart);

        const dataStart = headerStart + 1;
        patients.forEach((p, idx) => {
          const rNum = dataStart + idx;
          const row = wsPatients.getRow(rNum);
          row.values = [
            p.mrn || `PT-${p.id.slice(-6).toUpperCase()}`,
            p.name,
            p.phone,
            p.gender,
            p.age ?? "N/A",
            p.address || "Jashore, Bangladesh",
            p.createdAt.toISOString().slice(0, 10),
            p._count.appointments,
            p._count.medicalRecords,
            p.totalBill,
            p.totalPaid,
            p.totalDue,
          ];
        });

        const dataEnd = dataStart + patients.length - 1;
        if (patients.length > 0) {
          applyDataRowStyles(
            wsPatients,
            dataStart,
            dataEnd,
            {
              1: "center",
              2: "left",
              3: "center",
              4: "center",
              5: "center",
              6: "left",
              7: "center",
              8: "center",
              9: "center",
              10: "right",
              11: "right",
              12: "right",
            },
            {
              8: "#,##0",
              9: "#,##0",
              10: '"৳" #,##0.00',
              11: '"৳" #,##0.00',
              12: '"৳" #,##0.00',
            }
          );

          addSummaryRow(
            wsPatients,
            dataEnd + 1,
            "TOTAL PATIENT FINANCIAL BALANCES:",
            dataStart,
            dataEnd,
            [10, 11, 12]
          );
        }

        autoFitColumns(wsPatients, 14, 40);
      }

      // ───────────────────────────────────────────────────────────
      // SHEET 4: CLINICAL QUEUE & VISITS LOG
      // ───────────────────────────────────────────────────────────
      if (exportType === "all" || exportType === "appointments") {
        const wsQueue = workbook.addWorksheet("Clinical Queue & Visits", {
          views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
        });

        const headerStart = applyTitleBanner(
          wsQueue,
          "Clinical Queue & Service Visits Master Schedule",
          "Consultation & Physical Therapy Queue Log",
          dateLabel,
          15
        );

        const headers = [
          "Token Serial",
          "Appointment Date",
          "Told Time",
          "Patient MRN",
          "Patient Name",
          "Phone Number",
          "Service Type",
          "Booking Category",
          "Service Slot / Modality",
          "Chamber / Room",
          "Attending Doctor",
          "Queue Status",
          "Payment Status",
          "Service Fee (BDT)",
          "Clinical Notes",
        ];

        wsQueue.getRow(headerStart).values = headers;
        applyHeaderStyle(wsQueue, headerStart);

        const dataStart = headerStart + 1;
        appointments.forEach((a, idx) => {
          const rNum = dataStart + idx;
          const row = wsQueue.getRow(rNum);
          row.values = [
            `#${a.id.slice(-4).toUpperCase()}`,
            a.appointmentDate.toISOString().slice(0, 10),
            a.toldTime || a.willCallTime || "Next Available",
            a.patient?.mrn || "",
            a.patient?.name || "",
            a.patient?.phone || "",
            a.type,
            a.bookingType === "EXTRA" ? "EXTRA (APPROVED)" : "REGULAR SERIAL",
            a.therapySlot?.label || "General Assessment",
            a.room?.number ? `Room ${a.room.number}` : "Waiting Hall",
            getAttendingDoctorName(a),
            a.status,
            a.paymentStatus,
            getAppointmentFinancials(a).fee,
            a.notes || "None",
          ];
        });

        const dataEnd = dataStart + appointments.length - 1;
        if (appointments.length > 0) {
          applyDataRowStyles(
            wsQueue,
            dataStart,
            dataEnd,
            {
              1: "center",
              2: "center",
              3: "center",
              4: "center",
              5: "left",
              6: "center",
              7: "center",
              8: "center",
              9: "left",
              10: "center",
              11: "left",
              12: "center",
              13: "center",
              14: "right",
              15: "left",
            },
            {
              14: '"৳" #,##0.00',
            }
          );
        }

        autoFitColumns(wsQueue, 13, 38);
      }

      // ───────────────────────────────────────────────────────────
      // SHEET 5: SYSTEM SECURITY & AUDIT TRAIL
      // ───────────────────────────────────────────────────────────
      if (exportType === "all" || exportType === "audit") {
        const wsAudit = workbook.addWorksheet("Security & Audit Logs", {
          views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
        });

        const headerStart = applyTitleBanner(
          wsAudit,
          "System Security, Access & Audit Event Trail",
          "Tamper-Proof Local LAN Operation Records",
          dateLabel,
          10
        );

        const headers = [
          "Audit Log ID",
          "Timestamp",
          "Action Event",
          "Status",
          "User Role",
          "Authorized Performer",
          "Entity Affected",
          "Entity Record ID",
          "Client IP Address",
          "Operational Event Details",
        ];

        wsAudit.getRow(headerStart).values = headers;
        applyHeaderStyle(wsAudit, headerStart);

        const dataStart = headerStart + 1;
        auditLogs.forEach((l, idx) => {
          const rNum = dataStart + idx;
          const row = wsAudit.getRow(rNum);
          row.values = [
            l.id,
            l.createdAt.toISOString().replace("T", " ").slice(0, 19),
            l.action,
            l.status,
            l.user?.role || "SYSTEM",
            l.performer?.name || "System Admin",
            l.entity || "SYSTEM",
            l.entityId || "N/A",
            l.ipAddress || "127.0.0.1",
            l.details || "",
          ];
        });

        const dataEnd = dataStart + auditLogs.length - 1;
        if (auditLogs.length > 0) {
          applyDataRowStyles(wsAudit, dataStart, dataEnd, {
            1: "center",
            2: "center",
            3: "left",
            4: "center",
            5: "center",
            6: "left",
            7: "center",
            8: "center",
            9: "center",
            10: "left",
          });
        }

        autoFitColumns(wsAudit, 14, 45);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const nodeBuffer = Buffer.from(buffer);
      const filename = `HPC_Report_${exportType.toUpperCase()}_${filenameLabel}.xlsx`;

      return new NextResponse(nodeBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": nodeBuffer.length.toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CSV EXPORT WITH UTF-8 BOM FOR PERFECT EXCEL/GOOGLE SHEETS
    // ─────────────────────────────────────────────────────────────
    let csvContent = "";
    const filename = `HPC_Report_${exportType.toUpperCase()}_${filenameLabel}.csv`;

    if (exportType === "all" || exportType === "comprehensive") {
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
          medicalFile: { include: { doctor: true } },
          medicalRecords: { include: { doctor: true } },
          treatmentPlans: { include: { doctor: true } },
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

      const rows = appointments.map((a) => {
        const fin = getAppointmentFinancials(a);
        return [
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
          getAttendingDoctorName(a),
          a.performer?.name || "N/A",
          a.bookedBy?.name || "System",
          a.bookingType,
          a.status,
          a.paymentStatus,
          a.paymentMethod || "CASH",
          fin.fee,
          fin.paid,
          fin.due,
          a.notes || "",
        ];
      });

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");
    } else if (exportType === "payments" || exportType === "invoices") {
      const appointments = await prisma.appointment.findMany({
        where: dateFilterClause ? { appointmentDate: dateFilterClause } : undefined,
        orderBy: { appointmentDate: "desc" },
        include: {
          patient: true,
          doctor: true,
          performer: true,
          bookedBy: true,
          therapySlot: true,
          medicalFile: { include: { doctor: true } },
          medicalRecords: { include: { doctor: true } },
          treatmentPlans: { include: { doctor: true } },
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

      const rows = appointments.map((a) => {
        const fin = getAppointmentFinancials(a);
        return [
          `HPC-REC-${a.id.slice(-6).toUpperCase()}`,
          a.appointmentDate.toISOString().slice(0, 10),
          a.patient?.mrn || "",
          a.patient?.name || "",
          a.patient?.phone || "",
          a.type === "CONSULTATION" ? "Doctor Consultation" : (a.therapySlot?.label || "Physiotherapy"),
          a.paymentMethod || "CASH",
          a.paymentStatus,
          fin.fee,
          fin.paid,
          fin.due,
          getAttendingDoctorName(a),
          a.performer?.name || "N/A",
          a.bookedBy?.name || "Front Desk",
        ];
      });

      csvContent = [
        headers.map(sanitizeCsvField).join(","),
        ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
      ].join("\r\n");
    } else if (exportType === "patients") {
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
      const logs = await prisma.auditLog.findMany({
        where: dateFilterClause ? { createdAt: dateFilterClause } : undefined,
        take: 3000,
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

    // Prepend UTF-8 BOM (\uFEFF) so Excel and Google Sheets parse Bengali characters cleanly
    const csvBuffer = Buffer.from("\uFEFF" + csvContent, "utf-8");
    return new NextResponse(csvBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": csvBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Export Error]:", error);
    return new NextResponse("Failed to export report", { status: 500 });
  }
}
