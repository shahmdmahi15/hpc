"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Receipt,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  MapPin,
  Clock,
  Calendar,
  User,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";

interface ThermalReceiptDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
  cashierName?: string;
}

export function ThermalReceiptDialog({
  isOpen,
  onOpenChange,
  appointment,
  cashierName = "Cashier Desk",
}: ThermalReceiptDialogProps) {
  const [viewMode, setViewMode] = React.useState<"voucher" | "thermal">("voucher");
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  if (!appointment) return null;

  const receiptNo = `HPC-REC-${appointment.id.slice(-6).toUpperCase()}`;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const fee = appointment.feeAmount ?? CLINIC_CONFIG.defaultConsultationFee;
  const paid = appointment.paidAmount ?? (appointment.paymentStatus === "PAID" ? fee : 0);
  const due = Math.max(0, fee - paid);
  const isFullyPaid = due === 0;
  const patient = appointment.patient;
  const tokenNumber = appointment.id.slice(-4).toUpperCase();

  const handlePrint = () => {
    const targetId = viewMode === "voucher" ? "official-voucher-print" : "thermal-receipt-print";
    printElementIsolated(targetId, `Payment Receipt - ${receiptNo}`);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    const targetId = viewMode === "voucher" ? "official-voucher-print" : "thermal-receipt-print";
    const patientSlug = (patient?.name || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${receiptNo}_${patientSlug}.pdf`;

    try {
      const success = await downloadElementAsPdf(targetId, {
        filename,
        format: viewMode === "voucher" ? "a5" : "thermal",
        orientation: "portrait",
      });

      if (success) {
        toast.success("Receipt PDF downloaded successfully!");
      } else {
        toast.error("Failed to generate PDF. Please try again.");
      }
    } catch (error) {
      console.error("[Receipt PDF] Error:", error);
      toast.error("PDF generation encountered an error.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border shadow-2xl">
        <DialogHeader className="p-4 border-b border-border/70 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-emerald-600/10 text-emerald-600 flex items-center justify-center border border-emerald-600/20">
              <Receipt className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Official Payment Receipt &amp; Voucher</span>
                <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
                  {receiptNo}
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                High-resolution clinical cash memo and thermal slip
              </p>
            </div>
          </div>

          {/* View Format Selector Tabs */}
          <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("voucher")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "voucher"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Standard Voucher (A5)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("thermal")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "thermal"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              80mm Thermal Slip
            </button>
          </div>
        </DialogHeader>

        {/* Scrollable Receipt Preview Area */}
        <div className="p-4 sm:p-6 max-h-[72vh] overflow-y-auto bg-neutral-100/80 dark:bg-neutral-950 flex justify-center items-start">
          {viewMode === "voucher" ? (
            /* =========================================================================
             * 1. OFFICIAL MONEY RECEIPT / VOUCHER (A5 Format - Ultra High Quality)
             * ========================================================================= */
            <div
              id="official-voucher-print"
              className="w-full max-w-[540px] bg-white text-neutral-900 p-6 sm:p-7 rounded-md border border-neutral-300 shadow-md font-sans text-xs leading-relaxed"
              style={{ minHeight: "680px" }}
            >
              {/* Header Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-3.5 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-md bg-emerald-700 text-white flex items-center justify-center font-black text-sm tracking-wider shadow-xs">
                      {CLINIC_CONFIG.shortName}
                    </div>
                    <div>
                      <h1 className="font-black text-base sm:text-lg tracking-tight uppercase text-neutral-900 leading-tight">
                        {CLINIC_CONFIG.name}
                      </h1>
                      <p className="text-[10px] font-semibold text-emerald-800 tracking-wide">
                        {CLINIC_CONFIG.nameBangla}
                      </p>
                    </div>
                  </div>
                  <p className="text-[9.5px] font-medium text-neutral-600 pt-0.5">
                    {CLINIC_CONFIG.tagline}
                  </p>
                </div>

                <div className="text-right text-[9.5px] text-neutral-600 space-y-0.5">
                  <div className="flex items-center justify-end gap-1 font-bold text-neutral-900">
                    <Phone className="size-3 text-emerald-700" />
                    <span>Hotline: {CLINIC_CONFIG.phone}</span>
                  </div>
                  <div className="flex items-start justify-end gap-1 text-[9px] text-neutral-600 max-w-[190px] text-right">
                    <MapPin className="size-3 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{CLINIC_CONFIG.addressBangla}</span>
                  </div>
                  <p className="text-[8.5px] text-neutral-500 font-mono">
                    {CLINIC_CONFIG.city}, Bangladesh - {CLINIC_CONFIG.postalCode}
                  </p>
                </div>
              </div>

              {/* Title & Document Badge */}
              <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-700 text-white font-extrabold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-sm">
                    MONEY RECEIPT
                  </span>
                  <span className="text-[10.5px] font-bold text-neutral-800">
                    ক্যাশ মেমো
                  </span>
                </div>
                <div className="text-[10.5px] text-right">
                  <span className="text-neutral-500 mr-1">Receipt No:</span>
                  <span className="font-mono font-black text-neutral-900">{receiptNo}</span>
                </div>
              </div>

              {/* Patient Demographics & Appointment Info Grid */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-neutral-50/70 border border-neutral-200 rounded mb-3 text-[10.5px]">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-neutral-500 w-20 shrink-0 text-[10px]">Patient Name:</span>
                    <span className="font-bold text-neutral-900 truncate">
                      {patient?.name || "Anonymous Patient"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-neutral-500 w-20 shrink-0 text-[10px]">Patient MRN:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {patient?.mrn || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-neutral-500 w-20 shrink-0 text-[10px]">Contact Phone:</span>
                    <span className="font-mono text-neutral-800">
                      {patient?.phone || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 border-l border-neutral-200 pl-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-500 text-[10px]">Date &amp; Time:</span>
                    <span className="font-semibold text-neutral-800 text-[10px]">
                      {dateFormatted} • {timeFormatted}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-500 text-[10px]">Serial Token:</span>
                    <span className="font-mono font-bold bg-neutral-200 px-1.5 py-0.2 rounded text-[10px]">
                      #{tokenNumber}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-500 text-[10px]">Service Unit:</span>
                    <span className="font-medium text-neutral-800 text-[10px]">
                      {appointment.type === "CONSULTATION" ? "Doctor Chamber" : "Therapy Dept."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Services Table */}
              <div className="border border-neutral-300 rounded overflow-hidden mb-3">
                <table className="w-full text-left text-[10.5px]">
                  <thead className="bg-neutral-100 border-b border-neutral-300 text-neutral-700 font-bold uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="py-1.5 px-3 w-8 text-center">SL</th>
                      <th className="py-1.5 px-3">Service Description</th>
                      <th className="py-1.5 px-2 text-center w-14">Qty</th>
                      <th className="py-1.5 px-3 text-right w-24">Rate (BDT)</th>
                      <th className="py-1.5 px-3 text-right w-24">Total (BDT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    <tr className="bg-white">
                      <td className="py-2 px-3 text-center font-mono text-neutral-500">01</td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-neutral-900">
                          {appointment.type === "CONSULTATION"
                            ? "Doctor Consultation & Clinical Evaluation"
                            : "Physical Therapy & Rehabilitation Session"}
                        </div>
                        <div className="text-[9px] text-neutral-500 mt-0.5">
                          {appointment.therapySlot?.label
                            ? `Assigned: ${appointment.therapySlot.label}`
                            : appointment.doctor?.name
                              ? `Attending: ${appointment.doctor.name}`
                              : "Standard Clinical Protocol"}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-semibold">1</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">৳{fee.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                        ৳{fee.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation & Status Stamp Box */}
              <div className="grid grid-cols-12 gap-3 mb-4 items-center">
                {/* Stamp & Payment Status */}
                <div className="col-span-7 p-3 bg-neutral-50 border border-neutral-200 rounded flex flex-col justify-center items-start space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-600">Payment Mode:</span>
                    <span className="font-bold uppercase text-[10.5px] bg-neutral-200/80 px-2 py-0.5 rounded text-neutral-800">
                      {appointment.paymentMethod || "CASH"}
                    </span>
                  </div>

                  {isFullyPaid ? (
                    <div className="inline-flex items-center gap-1.5 border-2 border-emerald-700 bg-emerald-50 text-emerald-800 px-3 py-1 rounded font-black text-[11px] tracking-wider uppercase">
                      <CheckCircle2 className="size-3.5 text-emerald-700" />
                      <span>PAID IN FULL / পরিশোধিত</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 border-2 border-amber-600 bg-amber-50 text-amber-900 px-3 py-1 rounded font-black text-[11px] tracking-wider uppercase">
                      <AlertCircle className="size-3.5 text-amber-700" />
                      <span>DUE BALANCE / বকেয়া: ৳{due.toLocaleString()}</span>
                    </div>
                  )}

                  <p className="text-[8.5px] text-neutral-500 italic pt-0.5">
                    Computer-generated official money receipt. Valid without signature stamp.
                  </p>
                </div>

                {/* Calculation Summary Table */}
                <div className="col-span-5 bg-neutral-50 border border-neutral-300 rounded p-2.5 space-y-1 text-[10.5px]">
                  <div className="flex justify-between text-neutral-600">
                    <span>Total Amount:</span>
                    <span className="font-mono font-bold text-neutral-900">৳{fee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Discount / ছাড়:</span>
                    <span className="font-mono text-neutral-700">৳0</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-neutral-300 pt-1 text-neutral-900">
                    <span>Net Payable:</span>
                    <span className="font-mono text-emerald-800">৳{fee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-neutral-800">
                    <span>Amount Paid:</span>
                    <span className="font-mono text-neutral-900">৳{paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-neutral-300 pt-1 text-[11px]">
                    <span className={due > 0 ? "text-red-700" : "text-neutral-700"}>Due Balance:</span>
                    <span className={`font-mono ${due > 0 ? "text-red-700 font-black" : "text-neutral-700"}`}>
                      ৳{due.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures & Verification */}
              <div className="pt-4 border-t border-neutral-200 grid grid-cols-2 gap-6 text-[9.5px]">
                <div className="text-left">
                  <div className="h-6 flex items-end">
                    <span className="font-mono font-semibold text-neutral-700 text-[10px]">
                      {cashierName}
                    </span>
                  </div>
                  <div className="border-t border-neutral-400 pt-1">
                    <p className="font-bold text-neutral-800">Authorized Cashier / কর্মকর্তা</p>
                    <p className="text-neutral-500 text-[8.5px]">Health &amp; Pain Care Center</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="h-6"></div>
                  <div className="border-t border-neutral-400 pt-1">
                    <p className="font-bold text-neutral-800">Patient / Guardian Signature</p>
                    <p className="text-neutral-500 text-[8.5px]">রোগী অথবা অভিভাবকের স্বাক্ষর</p>
                  </div>
                </div>
              </div>

              {/* Clinic Full Location & Blessing Footer */}
              <div className="mt-4 pt-2.5 border-t border-neutral-300 text-center text-[9px] text-neutral-500 space-y-0.5">
                <p className="font-medium text-emerald-900">
                  Wishing you a fast, healthy and complete recovery! • আপনার দ্রুত সুস্থতা কামনা করছি।
                </p>
                <p className="text-neutral-600 font-medium">
                  {CLINIC_CONFIG.fullLocation}
                </p>
                <p className="text-[8px] text-neutral-400">
                  Appointments &amp; Inquiries: {CLINIC_CONFIG.phone} • Web: {CLINIC_CONFIG.web}
                </p>
              </div>
            </div>
          ) : (
            /* =========================================================================
             * 2. POS THERMAL RECEIPT SLIP (80mm Thermal Printer Roll Format)
             * ========================================================================= */
            <div
              id="thermal-receipt-print"
              className="w-full max-w-[300px] p-4 bg-white text-black font-mono text-[11px] leading-tight border border-neutral-300 rounded shadow-xs"
            >
              {/* Clinic Letterhead */}
              <div className="text-center pb-2 border-b border-black">
                <h2 className="font-black text-sm tracking-tight uppercase">
                  {CLINIC_CONFIG.name}
                </h2>
                <p className="text-[9px] uppercase tracking-wider text-neutral-700 font-bold">
                  {CLINIC_CONFIG.tagline}
                </p>
                <p className="text-[9px] text-neutral-800 mt-1 font-sans">
                  {CLINIC_CONFIG.addressBangla}
                </p>
                <p className="text-[9.5px] font-bold text-black mt-0.5">
                  Hotline: {CLINIC_CONFIG.phone}
                </p>
                <div className="mt-1.5 inline-block px-2.5 py-0.5 border border-black font-bold text-[10px] uppercase">
                  *** MONEY RECEIPT ***
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="py-2 border-b border-neutral-400 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Receipt No:</span>
                  <span className="font-bold">{receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Date &amp; Time:</span>
                  <span className="font-semibold">
                    {dateFormatted} {timeFormatted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Token Serial:</span>
                  <span className="font-bold">#{tokenNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Patient MRN:</span>
                  <span className="font-bold">{patient?.mrn || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Patient Name:</span>
                  <span className="font-bold truncate max-w-[160px]">
                    {patient?.name || "Patient"}
                  </span>
                </div>
                {patient?.phone && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Phone:</span>
                    <span>{patient.phone}</span>
                  </div>
                )}
              </div>

              {/* Itemized Table */}
              <div className="py-2 border-b border-black space-y-1.5 text-[10px]">
                <div className="flex justify-between font-bold border-b border-neutral-300 pb-1">
                  <span>Description</span>
                  <span>Amount</span>
                </div>

                <div className="flex justify-between pt-0.5">
                  <div>
                    <p className="font-bold">
                      {appointment.type === "CONSULTATION"
                        ? "Doctor Consultation"
                        : "Physiotherapy Session"}
                    </p>
                    <p className="text-[9px] text-neutral-600">
                      {appointment.therapySlot?.label || "Clinical Evaluation"}
                    </p>
                  </div>
                  <span className="font-bold">৳{fee}</span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="py-2 border-b-2 border-black space-y-1 text-[10.5px]">
                <div className="flex justify-between">
                  <span>Total Bill:</span>
                  <span className="font-bold">৳{fee}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Amount Received:</span>
                  <span>৳{paid}</span>
                </div>
                <div className="flex justify-between text-neutral-800">
                  <span>Due Balance:</span>
                  <span className={due > 0 ? "font-bold text-red-600" : "font-semibold"}>
                    ৳{due}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] pt-1 text-neutral-700">
                  <span>Payment Mode:</span>
                  <span className="font-bold uppercase">
                    {appointment.paymentMethod || "CASH"}
                  </span>
                </div>
              </div>

              {/* Paid Stamp & Sign-off */}
              <div className="pt-2 text-center">
                {isFullyPaid && (
                  <div className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 border-2 border-emerald-800 px-3 py-0.5 rounded uppercase tracking-wider mb-2">
                    <CheckCircle2 className="size-3 text-emerald-800" />
                    PAID IN FULL
                  </div>
                )}

                <div className="flex justify-between items-end text-[9px] pt-4 mt-2">
                  <div className="text-left">
                    <p className="border-t border-neutral-400 pt-0.5 font-bold">
                      Auth: {cashierName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="border-t border-neutral-400 pt-0.5">
                      Patient / Guardian
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-[8.5px] text-neutral-600 leading-tight space-y-0.5">
                  <p className="italic">
                    Wishing you a fast recovery. Please retain this receipt.
                  </p>
                  <p className="text-[8px] text-neutral-500 font-sans">
                    চাঁচড়া ডালমিল (পুলিশ ফাঁড়ির বিপরীতে), যশোর
                  </p>
                  <p className="text-[8px] text-neutral-500 font-mono">
                    Hotline: {CLINIC_CONFIG.phone}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Actions Footer */}
        <DialogFooter className="p-3.5 border-t border-border/70 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer w-full sm:w-auto"
          >
            Close
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200 border-border/80 hover:bg-muted cursor-pointer"
            >
              {isGeneratingPdf ? (
                <Loader2 className="size-3.5 animate-spin text-emerald-600" />
              ) : (
                <Download className="size-3.5 text-emerald-600" />
              )}
              <span>{isGeneratingPdf ? "Generating PDF..." : "Download PDF"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
            >
              <Printer className="size-3.5" />
              <span>Print Receipt</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
