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
import { Printer, Ticket, QrCode, Download, Loader2 } from "lucide-react";
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
    printElementIsolated("thermal-ticket-print", `Queue Token - #${appointment?.id.slice(-4).toUpperCase() || ""}`);
  };

  const handleDownloadPdf = async () => {
    if (!appointment) return;
    setIsGeneratingPdf(true);
    const tokenNo = appointment.id.slice(-4).toUpperCase();
    const filename = `HPC-Token-${tokenNo}.pdf`;

    try {
      const success = await downloadElementAsPdf("thermal-ticket-print", {
        filename,
        format: "thermal",
        orientation: "portrait",
      });

      if (success) {
        toast.success("Queue token PDF downloaded!");
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
  const due = isPaid ? 0 : (appointment.dueAmount ?? fee);
  const tokenNumber = appointment.id.slice(-4).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Ticket className="size-4 text-emerald-600" />
              <span>Queue Token Ticket</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Printable Ticket Preview Area */}
        <div className="p-4 max-h-[75vh] overflow-y-auto flex justify-center">
          <div
            id="thermal-ticket-print"
            className="w-full max-w-[290px] p-4 bg-white text-black font-mono text-[11px] leading-tight border border-dashed border-neutral-300 rounded shadow-xs"
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-black">
              <h2 className="font-extrabold text-sm tracking-tight uppercase">
                {CLINIC_CONFIG.name}
              </h2>
              <p className="text-[9.5px] uppercase tracking-wider text-neutral-700 font-bold">
                {CLINIC_CONFIG.tagline}
              </p>
              <p className="text-[8.5px] text-neutral-600 mt-0.5 font-sans">
                {CLINIC_CONFIG.addressBangla}
              </p>
              <p className="text-[9px] text-neutral-800 font-bold mt-0.5">
                Hotline: {CLINIC_CONFIG.phone}
              </p>
            </div>

            {/* Token Badge */}
            <div className="text-center py-2.5 my-1.5 border-b-2 border-black border-dashed">
              <p className="text-[10px] uppercase font-bold text-neutral-600">
                {appointment.type} TOKEN
              </p>
              <div className="text-3xl font-extrabold tracking-tighter my-0.5">
                #{tokenNumber}
              </div>
              <p className="text-[10px] font-semibold">
                {appointment.bookingType === "EXTRA" ? "★ EXTRA SLOT ★" : "REGULAR SERIAL"}
              </p>
            </div>

            {/* Patient & Booking Details */}
            <div className="space-y-1 py-1.5 border-b border-black text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-neutral-600">Date:</span>
                <span className="font-bold">{dateStr}</span>
              </div>
              {appointment.toldTime && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Told Arrival:</span>
                  <span className="font-bold">{appointment.toldTime}</span>
                </div>
              )}
              {appointment.therapySlot && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Slot:</span>
                  <span className="font-bold">{appointment.therapySlot.label}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-600">Patient:</span>
                <span className="font-bold truncate max-w-[170px]">
                  {appointment.patient?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">MRN:</span>
                <span className="font-bold">{appointment.patient?.mrn || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Gender / Age:</span>
                <span className="font-bold">
                  {appointment.gender} {appointment.patient?.age ? `• ${appointment.patient.age}y` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Assigned Room:</span>
                <span className="font-bold">
                  {appointment.room?.number || appointment.therapySlot?.room?.number || "Waiting Hall"}
                </span>
              </div>
              {appointment.doctor && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Doctor:</span>
                  <span className="font-bold">{appointment.doctor.name}</span>
                </div>
              )}
            </div>

            {/* Financial Status */}
            <div className="py-2 border-b border-black text-[10.5px]">
              <div className="flex justify-between font-bold">
                <span>Fee Amount:</span>
                <span>৳{fee} BDT</span>
              </div>
              <div className="flex justify-between text-[10px] mt-0.5">
                <span className="text-neutral-600">Billing Status:</span>
                <span className={isPaid ? "font-bold text-emerald-800" : "font-bold text-red-800"}>
                  {isPaid ? "PAID" : `DUE ৳${due}`}
                </span>
              </div>
            </div>

            {/* QR / Instructions */}
            <div className="text-center pt-2 space-y-1">
              <div className="inline-flex p-1.5 bg-neutral-100 rounded border border-neutral-300">
                <QrCode className="size-10 text-neutral-800" />
              </div>
              <p className="text-[9px] text-neutral-600">
                Please wait in the reception lobby. Your number will be announced on the screen.
              </p>
              <p className="text-[8.5px] text-neutral-500 font-mono">
                Printed: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="gap-1 font-semibold cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              <span>PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Print Slip</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
