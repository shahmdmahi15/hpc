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
import { Printer, Ticket, QrCode, Download, Loader2, Phone, MapPin } from "lucide-react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";

interface ThermalTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
}

export function ThermalTicketDialog({
  isOpen,
  onOpenChange,
  appointment,
}: ThermalTicketDialogProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  const handlePrint = () => {
    printElementIsolated("standard-ticket-print", {
      title: `Therapy Queue Slip - Token #${appointment?.id.slice(-4).toUpperCase() || ""}`,
      paperSize: "80mm",
    });
  };

  const handleDownloadPdf = async () => {
    if (!appointment) return;
    setIsGeneratingPdf(true);
    const tokenNo = appointment.id.slice(-4).toUpperCase();
    const filename = `HPC-Therapy-Token-${tokenNo}.pdf`;

    try {
      const success = await downloadElementAsPdf("standard-ticket-print", {
        filename,
        format: "thermal",
        orientation: "portrait",
      });

      if (success) {
        toast.success("Physical Therapy queue slip PDF downloaded!");
      } else {
        toast.error("Failed to generate PDF slip.");
      }
    } catch (err) {
      console.error("[Token PDF] Error:", err);
      toast.error("Error generating slip PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!appointment) return null;

  const dateStr = appointment.appointmentDate
    ? new Date(appointment.appointmentDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-GB");

  const fee = appointment.feeAmount ?? CLINIC_CONFIG.defaultConsultationFee;
  const isPaid = appointment.paymentStatus === "PAID";
  const paid = isPaid ? fee : (appointment.paidAmount ?? 0);
  const due = isPaid ? 0 : Math.max(0, fee - paid);
  const tokenNumber = appointment.id.slice(-4).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Ticket className="size-4 text-emerald-600" />
              <span>Physical Therapy Queue Slip</span>
            </DialogTitle>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border self-start sm:self-auto">
              80mm Thermal Slip
            </span>
          </div>
        </DialogHeader>

        {/* Printable Ticket Preview Area (Formatted for standard 80mm continuous thermal POS rolls) */}
        <div className="p-3 sm:p-5 flex-1 min-h-0 overflow-y-auto overscroll-contain overflow-x-auto flex justify-center bg-neutral-200/70 dark:bg-neutral-950">
          <div
            id="standard-ticket-print"
            className="w-full max-w-[340px] bg-white text-black p-4 rounded-lg border border-slate-300 font-sans space-y-3 shadow-inner"
          >
            {/* Clinic Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-2 space-y-0.5">
              <div className="flex justify-center mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.jpg"
                  alt="HPC Logo"
                  className="size-9 object-contain"
                />
              </div>
              <h2 className="text-xs font-black tracking-wide uppercase text-slate-900 leading-tight">
                {CLINIC_CONFIG.name}
              </h2>
              <p className="text-[9.5px] font-semibold text-slate-700">
                {CLINIC_CONFIG.nameBangla}
              </p>
              <p className="text-[8.5px] text-slate-500 font-mono">
                {CLINIC_CONFIG.phone} • {CLINIC_CONFIG.city}
              </p>
            </div>

            {/* Big Token Number Centerpiece */}
            <div className="text-center py-2 bg-slate-100 rounded border border-slate-200">
              <div className="text-[9.5px] font-bold text-slate-600 uppercase tracking-widest">
                {appointment.type === "THERAPY" ? "PHYSICAL THERAPY QUEUE" : `${appointment.type} SERVICE QUEUE`}
              </div>
              <div className="text-4xl font-black text-slate-900 font-mono tracking-tight my-0.5">
                #{tokenNumber}
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-900 text-white">
                {appointment.bookingType === "EXTRA" ? "★ EXTRA SLOT (APPROVED)" : "REGULAR SERIAL"}
              </div>
            </div>

            {/* Patient & Service Details */}
            <div className="space-y-1.5 text-xs border-b border-dashed border-slate-300 pb-2.5">
              <div className="flex justify-between items-start">
                <span className="text-slate-500 font-medium text-[11px]">Patient:</span>
                <span className="font-bold text-slate-900 text-right text-[11px] truncate max-w-[190px]">
                  {appointment.patient?.name || "Patient"} ({appointment.patient?.gender || "N/A"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium text-[11px]">Phone:</span>
                <span className="font-mono text-slate-900 text-[11px]">
                  {appointment.patient?.phone || "N/A"}
                </span>
              </div>
              {appointment.patient?.mrn && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium text-[11px]">MRN:</span>
                  <span className="font-mono text-slate-900 text-[11px]">
                    {appointment.patient.mrn}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-start">
                <span className="text-slate-500 font-medium text-[11px]">Unit / Chamber:</span>
                <span className="font-bold text-slate-900 text-right text-[11px]">
                  {appointment.room?.number
                    ? `Chamber Room ${appointment.room.number}`
                    : appointment.therapySlot?.room?.number
                    ? `Therapy Room ${appointment.therapySlot.room.number}`
                    : "Main Therapy Hall"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500 font-medium text-[11px]">Specialist / Desk:</span>
                <span className="font-semibold text-slate-900 text-right text-[11px] truncate max-w-[180px]">
                  {appointment.doctor?.name || "Physiotherapy & Rehabilitation Desk"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium text-[11px]">Date &amp; Time:</span>
                <span className="font-mono text-slate-900 text-[11px]">
                  {dateStr} • {appointment.willCallTime || appointment.toldTime || "Walk-In"}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-600 font-bold text-[11px]">Service Fee:</span>
                <span className="font-bold text-slate-900 font-mono text-[11px]">
                  ৳{fee.toLocaleString()} ({isPaid ? "PAID" : `DUE: ৳${due.toLocaleString()}`})
                </span>
              </div>
            </div>

            {/* Guidance & Notice Box */}
            <div className="text-center text-[9.5px] text-slate-600 space-y-1">
              <p className="font-medium leading-relaxed">
                <strong className="text-slate-900">রোগী নির্দেশিকা:</strong> অনুগ্রহপূর্বক এই টোকেনটি সাথে রাখুন। ওয়েটিং রুমের ডিজিটাল ডিসপ্লে স্ক্রিনে আপনার সিরিয়াল লক্ষ্য করুন অথবা লাউডস্পিকারের ভয়েস কল শুনুন।
              </p>
              <p className="font-mono text-[8.5px] text-slate-400">
                {CLINIC_CONFIG.fullLocation} • HPC-LAN
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3.5 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
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
              className="gap-1 font-semibold cursor-pointer flex-1 sm:flex-initial"
            >
              {isGeneratingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              <span>Download PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs flex-1 sm:flex-initial"
            >
              <Printer className="size-3.5" />
              <span>Print Thermal Slip (80mm)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
