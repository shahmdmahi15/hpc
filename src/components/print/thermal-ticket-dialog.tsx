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
    printElementIsolated(
      "standard-ticket-print",
      `Queue Slip - Token #${appointment?.id.slice(-4).toUpperCase() || ""}`
    );
  };

  const handleDownloadPdf = async () => {
    if (!appointment) return;
    setIsGeneratingPdf(true);
    const tokenNo = appointment.id.slice(-4).toUpperCase();
    const filename = `HPC-Token-${tokenNo}.pdf`;

    try {
      const success = await downloadElementAsPdf("standard-ticket-print", {
        filename,
        format: "custom-5.5x8.125",
        orientation: "portrait",
      });

      if (success) {
        toast.success("Queue token slip PDF downloaded!");
      } else {
        toast.error("Failed to generate PDF token.");
      }
    } catch (err) {
      console.error("[Token PDF] Error:", err);
      toast.error("Error generating token PDF.");
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
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[86vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Ticket className="size-4 text-emerald-600" />
              <span>Queue Token &amp; Intake Slip</span>
            </DialogTitle>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border self-start sm:self-auto">
              5.5″ × 8.27″ (HPC Paper)
            </span>
          </div>
        </DialogHeader>

        {/* Printable Ticket Preview Area (Formatted for 5.5" x 8.27" custom Wi-Fi paper) */}
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto overflow-x-hidden flex justify-center bg-neutral-200/70 dark:bg-neutral-950">
          <div
            id="standard-ticket-print"
            className="w-full max-w-[500px] min-h-[750px] p-4 sm:p-5 bg-white text-black font-sans text-xs leading-normal border border-black rounded-xs shadow-xl flex flex-col justify-between"
          >
            {/* Top Section */}
            <div className="space-y-2.5">
              {/* Header Letterhead with Official Logo */}
              <div className="flex items-start justify-between border-b-2 border-black pb-2.5 mb-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.jpg"
                    alt="Health & Pain Care Center Logo"
                    className="size-13 object-contain shrink-0"
                  />
                  <div>
                    <h1 className="font-black text-base tracking-tight uppercase text-black leading-tight">
                      {CLINIC_CONFIG.name}
                    </h1>
                    <p className="text-[10px] font-bold text-neutral-800 tracking-wide">
                      {CLINIC_CONFIG.nameBangla}
                    </p>
                    <p className="text-[9px] font-medium text-neutral-600 pt-0.5">
                      {CLINIC_CONFIG.tagline}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[9px] text-neutral-800 space-y-0.5">
                  <div className="flex items-center justify-end gap-1 font-bold text-black">
                    <Phone className="size-2.5 text-black" />
                    <span>Hotline: {CLINIC_CONFIG.phone}</span>
                  </div>
                  <div className="flex items-start justify-end gap-1 text-[8.5px] text-neutral-700 max-w-[170px] text-right">
                    <MapPin className="size-2.5 text-black shrink-0 mt-0.5" />
                    <span>{CLINIC_CONFIG.addressBangla}</span>
                  </div>
                  <p className="text-[8px] text-neutral-600 font-mono">
                    {CLINIC_CONFIG.city}, Bangladesh
                  </p>
                </div>
              </div>

              {/* Document Header Bar */}
              <div className="flex items-center justify-between border-y border-black py-1 mb-2 bg-neutral-50 print:bg-white">
                <div className="flex items-center gap-2">
                  <span className="bg-black text-white font-black text-[9.5px] tracking-wider uppercase px-2 py-0.5 rounded-xs">
                    PATIENT INTAKE TOKEN
                  </span>
                  <span className="text-[10.5px] font-bold text-black">
                    ক্রমিক টোকেন ও রিসিট
                  </span>
                </div>
                <div className="text-[10px] text-right font-mono font-bold text-black">
                  {dateStr}
                </div>
              </div>

              {/* Token Badge Centerpiece (B&W High Contrast) */}
              <div className="border-2 border-black rounded-xs p-3.5 my-2 text-center bg-white">
                <span className="text-[10px] uppercase font-bold text-neutral-700 tracking-wider block">
                  {appointment.type} SERVICE QUEUE
                </span>
                <div className="text-5xl sm:text-6xl font-black text-black tracking-tight my-1.5 font-mono">
                  #{tokenNumber}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-xs text-[10px] font-black uppercase bg-black text-white">
                  {appointment.bookingType === "EXTRA" ? "★ EXTRA SLOT (APPROVED)" : "REGULAR SERIAL"}
                </div>
              </div>

              {/* Patient & Booking Details (2 Columns) */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-white rounded-xs border border-neutral-800 text-[10.5px] mb-2">
                <div className="space-y-1">
                  <div>
                    <span className="text-[9.5px] text-neutral-600 block font-medium">Patient Name:</span>
                    <span className="font-bold text-black uppercase truncate block">
                      {appointment.patient?.name || "Patient"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-neutral-600 block font-medium">Patient MRN / Phone:</span>
                    <span className="font-mono font-bold text-black block">
                      {appointment.patient?.mrn || appointment.patient?.phone || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-neutral-600 block font-medium">Expected Call Time:</span>
                    <span className="font-mono font-bold text-black block">
                      {appointment.willCallTime || appointment.toldTime || "Next Available"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 border-l border-neutral-300 pl-3">
                  <div>
                    <span className="text-[9.5px] text-neutral-600 block font-medium">Service Unit / Chamber:</span>
                    <span className="font-bold text-black block">
                      {appointment.room?.number ? `Chamber Room ${appointment.room.number}` : appointment.therapySlot?.room?.number ? `Therapy Room ${appointment.therapySlot.room.number}` : "Main Waiting Hall"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-neutral-600 block font-medium">Attending Specialist / Desk:</span>
                    <span className="font-semibold text-black block truncate">
                      {appointment.doctor?.name ||
                        (appointment.type === "CONSULTATION"
                          ? "Dr. Farhan Ahmed, PT, DPT"
                          : "Physiotherapy & Rehabilitation Desk")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-neutral-600 block font-medium">Issue Time:</span>
                    <span className="font-mono text-neutral-700 block">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Status Strip (Crisp Monochrome) */}
              <div className="flex items-center justify-between p-2.5 rounded-xs border border-black text-xs mb-2.5 bg-white">
                <div>
                  <span className="text-neutral-600 text-[9.5px] block font-medium">Service Fee / ফি:</span>
                  <span className="font-black text-black font-sans text-sm">৳ {fee.toLocaleString()} BDT</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-600 text-[9.5px] block font-medium">Payment Status:</span>
                  <span className={`font-black uppercase text-[10.5px] px-2.5 py-0.5 rounded-xs border border-black ${
                    isPaid ? "bg-white text-black font-black" : "bg-neutral-200 text-black"
                  }`}>
                    {isPaid ? "★ PAID IN FULL ★" : `⚠ DUE: ৳ ${due.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Guidance & Notice Box */}
              <div className="border border-neutral-400 p-2.5 rounded-xs text-[9.5px] text-neutral-800 space-y-1 mb-2">
                <div className="flex items-center gap-2.5">
                  <QrCode className="size-9 text-black shrink-0" />
                  <p className="leading-relaxed">
                    <span className="font-bold text-black">রোগী নির্দেশিকা:</span> অনুগ্রহপূর্বক এই টোকেনটি সাথে রাখুন। ওয়েটিং রুমের ডিজিটাল ডিসপ্লে স্ক্রিনে আপনার সিরিয়াল লক্ষ্য করুন অথবা লাউডস্পিকারের ভয়েস কল শুনুন।
                  </p>
                </div>
              </div>
            </div>

            {/* Flexible Spacer */}
            <div className="flex-1 min-h-6"></div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-black flex justify-between items-center text-[9px] text-neutral-600">
              <span>{CLINIC_CONFIG.fullLocation}</span>
              <span className="font-mono font-bold text-black">HPC-LAN-OFFLINE-SYS</span>
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
              <span>Print Slip (5.5″ × 8.125″)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
