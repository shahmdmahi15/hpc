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
    printElementIsolated("official-voucher-print", `Payment Receipt - ${receiptNo}`);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    const targetId = "official-voucher-print";
    const patientSlug = (patient?.name || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${receiptNo}_${patientSlug}.pdf`;

    try {
      const success = await downloadElementAsPdf(targetId, {
        filename,
        format: "custom-5.5x8.125",
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
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/70 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
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
                High-resolution clinical cash memo formatted for 5.5″ × 8.27″ (13.97 cm × 21.00 cm) HPC paper
              </p>
            </div>
          </div>

          <div className="flex items-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-lg border border-emerald-500/20 text-xs font-semibold self-start sm:self-auto">
            <span>5.5″ × 8.27″ (HPC Paper)</span>
          </div>
        </DialogHeader>

        {/* Scrollable Receipt Preview Area */}
        <div className="p-3 sm:p-6 flex-1 min-h-0 overflow-y-auto overscroll-contain overflow-x-hidden bg-neutral-200/70 dark:bg-neutral-950 flex justify-center items-start">
          <div
            id="official-voucher-print"
            className="w-full max-w-[500px] min-h-[750px] bg-white text-black p-4 sm:p-5 rounded-xs border border-black shadow-xl font-sans text-xs leading-normal flex flex-col justify-between"
          >
            {/* Top Section */}
            <div className="space-y-2.5">
              {/* Header Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-2.5">
                <div className="flex items-center gap-3">
                  {/* Official HPC Logo from public/logo.jpg */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.jpg"
                    alt="Health & Pain Care Center Logo"
                    className="size-14 sm:size-15 object-contain shrink-0"
                  />
                  <div>
                    <h1 className="font-black text-base sm:text-lg tracking-tight uppercase text-black leading-tight">
                      {CLINIC_CONFIG.name}
                    </h1>
                    <p className="text-[11px] font-bold text-neutral-800 tracking-wide">
                      {CLINIC_CONFIG.nameBangla}
                    </p>
                    <p className="text-[9.5px] font-medium text-neutral-600 pt-0.5">
                      {CLINIC_CONFIG.tagline}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[9.5px] text-neutral-800 space-y-0.5">
                  <div className="flex items-center justify-end gap-1 font-bold text-black">
                    <Phone className="size-3 text-black" />
                    <span>Hotline: {CLINIC_CONFIG.phone}</span>
                  </div>
                  <div className="flex items-start justify-end gap-1 text-[9px] text-neutral-700 max-w-[190px] text-right">
                    <MapPin className="size-3 text-black shrink-0 mt-0.5" />
                    <span>{CLINIC_CONFIG.addressBangla}</span>
                  </div>
                  <p className="text-[8.5px] text-neutral-600 font-mono">
                    {CLINIC_CONFIG.city}, Bangladesh - {CLINIC_CONFIG.postalCode}
                  </p>
                </div>
              </div>

              {/* Document Title & Voucher Bar */}
              <div className="flex items-center justify-between border-y border-black py-1.5 mb-2.5 bg-neutral-50 print:bg-white">
                <div className="flex items-center gap-2">
                  <span className="bg-black text-white font-black text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-xs">
                    MONEY RECEIPT
                  </span>
                  <span className="text-[11px] font-bold text-black">
                    ক্যাশ মেমো
                  </span>
                </div>
                <div className="text-[11px] text-right">
                  <span className="text-neutral-600 mr-1.5 font-medium">Receipt No:</span>
                  <span className="font-mono font-black text-black text-xs">{receiptNo}</span>
                </div>
              </div>

              {/* Patient Demographics & Appointment Info Grid */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-white border border-neutral-800 rounded-xs mb-2.5 text-[10.5px]">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-neutral-600 w-22 shrink-0 text-[10px] font-medium">Patient Name:</span>
                    <span className="font-bold text-black truncate uppercase">
                      {patient?.name || "Anonymous Patient"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-neutral-600 w-22 shrink-0 text-[10px] font-medium">Patient MRN:</span>
                    <span className="font-mono font-black text-black">
                      {patient?.mrn || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-neutral-600 w-22 shrink-0 text-[10px] font-medium">Contact Phone:</span>
                    <span className="font-mono font-bold text-black">
                      {patient?.phone || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 border-l border-neutral-300 pl-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-600 text-[10px] font-medium">Date &amp; Time:</span>
                    <span className="font-bold text-black text-[10px]">
                      {dateFormatted} • {timeFormatted}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-600 text-[10px] font-medium">Serial Token:</span>
                    <span className="font-mono font-black text-black border border-black bg-neutral-100 px-1.5 py-0.2 rounded-xs text-[10px]">
                      #{tokenNumber}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-600 text-[10px] font-medium">Service Unit:</span>
                    <span className="font-bold text-black text-[10px]">
                      {appointment.type === "CONSULTATION" ? "Doctor Chamber" : "Therapy Dept."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Services Table */}
              <div className="border border-black rounded-xs overflow-hidden mb-2.5">
                <table className="w-full text-left text-[10.5px]">
                  <thead className="bg-neutral-100 border-b-2 border-black text-black font-black uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="py-1.5 px-3 w-8 text-center border-r border-neutral-300">SL</th>
                      <th className="py-1.5 px-3 border-r border-neutral-300">Service Description</th>
                      <th className="py-1.5 px-2 text-center w-14 border-r border-neutral-300">Qty</th>
                      <th className="py-1.5 px-3 text-right w-24 border-r border-neutral-300">Rate (৳)</th>
                      <th className="py-1.5 px-3 text-right w-24">Total (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300">
                    <tr className="bg-white">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-black border-r border-neutral-200">01</td>
                      <td className="py-2.5 px-3 border-r border-neutral-200">
                        <div className="font-black text-black text-[11px]">
                          {appointment.type === "CONSULTATION"
                            ? "Doctor Consultation & Clinical Evaluation"
                            : "Physical Therapy & Rehabilitation Session"}
                        </div>
                        <div className="text-[9.5px] text-neutral-600 mt-0.5 font-medium">
                          {appointment.therapySlot?.label
                            ? `Assigned: ${appointment.therapySlot.label}`
                            : appointment.doctor?.name
                              ? `Attending: ${appointment.doctor.name}`
                              : "Standard Clinical Protocol"}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-black border-r border-neutral-200">1</td>
                      <td className="py-2.5 px-3 text-right font-sans font-bold text-black border-r border-neutral-200">৳ {fee.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-sans font-black text-black">
                        ৳ {fee.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation & Status Stamp Box */}
              <div className="grid grid-cols-12 gap-2.5 mb-2.5 items-stretch">
                {/* Stamp & Payment Status */}
                <div className="col-span-7 p-2.5 border border-black rounded-xs flex flex-col justify-between items-start space-y-1.5 bg-white">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-neutral-600 font-medium">Payment Mode:</span>
                    <span className="font-sans font-bold uppercase text-[10.5px] border border-black px-2 py-0.5 rounded-xs text-black">
                      {appointment.paymentMethod || "CASH"}
                    </span>
                  </div>

                  {isFullyPaid ? (
                    <div className="w-full border-2 border-black bg-white p-2 text-center rounded-xs">
                      <div className="font-black text-xs tracking-wider uppercase text-black">
                        ★ PAID IN FULL / পরিশোধিত ★
                      </div>
                      <div className="text-[8px] uppercase tracking-wider text-neutral-600 font-medium mt-0.5">
                        No Balance Due • Official Cash Memo
                      </div>
                    </div>
                  ) : (
                    <div className="w-full border-2 border-black bg-neutral-100 p-2 text-center rounded-xs">
                      <div className="font-black text-xs tracking-wider uppercase text-black">
                        ⚠ DUE BALANCE / বকেয়া: ৳ {due.toLocaleString()}
                      </div>
                      <div className="text-[8px] uppercase tracking-wider text-neutral-700 font-medium mt-0.5">
                        Please Settle at Cash Desk
                      </div>
                    </div>
                  )}

                  <p className="text-[8px] text-neutral-500 italic">
                    Computer-generated official money receipt. Valid without signature stamp.
                  </p>
                </div>

                {/* Calculation Summary Table */}
                <div className="col-span-5 border border-black rounded-xs p-2.5 space-y-1 text-[10.5px] bg-white flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex justify-between text-neutral-700">
                      <span>Total Amount:</span>
                      <span className="font-sans font-bold text-black">৳ {fee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-700">
                      <span>Discount / ছাড়:</span>
                      <span className="font-sans font-medium text-black">৳ 0</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-neutral-300 pt-1 text-black">
                      <span>Net Payable:</span>
                      <span className="font-sans font-bold text-black">৳ {fee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-black">
                      <span>Amount Paid:</span>
                      <span className="font-sans font-bold text-black">৳ {paid.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-black border-t-2 border-black pt-1 text-[11px] text-black">
                    <span>Due Balance:</span>
                    <span className="font-sans font-black text-black">
                      ৳ {due.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flexible Spacer for Full-Page Balance */}
            <div className="flex-1 min-h-6"></div>

            {/* Bottom Section */}
            <div className="space-y-3 pt-2">
              {/* Signatures & Verification */}
              <div className="pt-2 border-t border-neutral-300 grid grid-cols-2 gap-6 text-[9.5px]">
                <div className="text-left">
                  <div className="h-8 flex items-end">
                    <span className="font-mono font-bold text-black text-[10px]">
                      {cashierName}
                    </span>
                  </div>
                  <div className="border-t border-black pt-1">
                    <p className="font-bold text-black">Authorized Officer / কর্মকর্তা</p>
                    <p className="text-neutral-600 text-[8.5px]">Health &amp; Pain Care Center</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="h-8"></div>
                  <div className="border-t border-black pt-1">
                    <p className="font-bold text-black">Patient / Guardian Signature</p>
                    <p className="text-neutral-600 text-[8.5px]">রোগী অথবা অভিভাবকের স্বাক্ষর</p>
                  </div>
                </div>
              </div>

              {/* Clinic Full Location & Blessing Footer */}
              <div className="pt-2 border-t border-black text-center text-[9px] text-neutral-700 space-y-0.5">
                <p className="font-bold text-black">
                  Wishing you a fast, healthy and complete recovery! • আপনার দ্রুত সুস্থতা কামনা করছি।
                </p>
                <p className="text-neutral-700 font-medium">
                  {CLINIC_CONFIG.fullLocation}
                </p>
                <p className="text-[8px] text-neutral-500 font-mono">
                  Hotline: {CLINIC_CONFIG.phone} • Web: {CLINIC_CONFIG.web}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dialog Actions Footer */}
        <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer w-full sm:w-auto"
          >
            Close
          </Button>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200 border-border/80 hover:bg-muted cursor-pointer flex-1 sm:flex-initial"
            >
              {isGeneratingPdf ? (
                <Loader2 className="size-3.5 animate-spin text-emerald-600" />
              ) : (
                <Download className="size-3.5 text-emerald-600" />
              )}
              <span>{isGeneratingPdf ? "Generating..." : "Download PDF"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs flex-1 sm:flex-initial"
            >
              <Printer className="size-3.5" />
              <span>Print Receipt (5.5″ × 8.125″)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
