"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Pill, Phone, MapPin, Loader2 } from "lucide-react";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";
import type { PrescriptionMedicineItem } from "@/actions/doctor/prescription.action";

export interface PrescriptionPrintRecord {
  id?: string;
  diagnosis?: string | null;
  medicines: PrescriptionMedicineItem[];
  advice?: string | null;
  followUpDate?: string | Date | null;
  createdAt?: string | Date;
  doctor?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  patient?: {
    name: string;
    mrn?: string | null;
    age?: number | string | null;
    gender?: string | null;
    phone?: string | null;
  } | null;
}

interface PrescriptionPrintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: PrescriptionPrintRecord | null;
}

export function PrescriptionPrintDialog({
  isOpen,
  onOpenChange,
  prescription,
}: PrescriptionPrintDialogProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  if (!prescription || !prescription.patient) return null;

  const { patient, doctor, medicines, diagnosis, advice, followUpDate, createdAt } =
    prescription;

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  const formattedFollowUp = followUpDate
    ? new Date(followUpDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const handlePrint = () => {
    printElementIsolated(
      "official-prescription-print",
      `Prescription - ${patient.name || "Patient"}`
    );
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    const patientSlug = (patient.name || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `HPC-Rx-${patient.mrn || "PT"}-${patientSlug}.pdf`;

    try {
      const success = await downloadElementAsPdf("official-prescription-print", {
        filename,
        format: "custom-5.5x8.125",
        orientation: "portrait",
      });

      if (success) {
        toast.success("Prescription PDF downloaded successfully!");
      } else {
        toast.error("Failed to generate PDF. Please try again.");
      }
    } catch (e) {
      console.error("[Prescription PDF Error]:", e);
      toast.error("Error creating prescription PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatSchedule = (times: ("MORNING" | "AFTERNOON" | "NIGHT")[]) => {
    const m = times.includes("MORNING") ? "1" : "0";
    const a = times.includes("AFTERNOON") ? "1" : "0";
    const n = times.includes("NIGHT") ? "1" : "0";
    return `${m} + ${a} + ${n}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 border-b border-border/70 bg-muted/30 flex flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-sky-600/10 text-sky-600 flex items-center justify-center border border-sky-600/20">
              <Pill className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Medical Prescription Voucher</span>
                <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
                  {patient.mrn || "RX"}
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Formatted for 5.5″ × 8.27″ (13.97 cm × 21.00 cm) HPC official prescription paper
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              {isGeneratingPdf ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>PDF</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Print Prescription</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Printable Container */}
        <div className="p-3 sm:p-6 flex-1 min-h-0 overflow-y-auto overscroll-contain bg-neutral-200/70 dark:bg-neutral-950 flex justify-center items-start">
          <div
            id="official-prescription-print"
            className="w-full max-w-[500px] min-h-[750px] bg-white text-black p-4 sm:p-5 rounded-xs border border-black shadow-xl font-sans text-xs leading-normal flex flex-col justify-between"
          >
            {/* Top Section */}
            <div className="space-y-3">
              {/* Header Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-2">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.jpg"
                    alt="Health & Pain Care Center Logo"
                    className="size-13 object-contain shrink-0"
                  />
                  <div>
                    <h1 className="font-black text-base uppercase text-black leading-tight">
                      {CLINIC_CONFIG.name}
                    </h1>
                    <p className="text-[10px] font-bold text-neutral-800">
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
                  <div className="flex items-start justify-end gap-1 text-[8.5px] text-neutral-700 max-w-[180px] text-right">
                    <MapPin className="size-2.5 text-black shrink-0 mt-0.5" />
                    <span>{CLINIC_CONFIG.addressBangla}</span>
                  </div>
                </div>
              </div>

              {/* Doctor Details Bar */}
              <div className="flex items-center justify-between bg-neutral-50 px-2.5 py-1.5 border border-neutral-300 rounded-xs text-[10px]">
                <div>
                  <span className="font-bold text-black">Doctor: </span>
                  <span className="font-semibold text-neutral-800">{doctor?.name || "Consultant"}</span>
                </div>
                <div>
                  <span className="font-bold text-black">Date: </span>
                  <span className="font-mono text-neutral-800">{formattedDate}</span>
                </div>
              </div>

              {/* Patient Demographics Bar */}
              <div className="grid grid-cols-4 gap-2 border border-black p-2 text-[10px] bg-white">
                <div>
                  <span className="font-bold block text-neutral-600">Patient:</span>
                  <span className="font-black uppercase text-black">{patient.name}</span>
                </div>
                <div>
                  <span className="font-bold block text-neutral-600">MRN:</span>
                  <span className="font-mono font-bold text-black">{patient.mrn || "N/A"}</span>
                </div>
                <div>
                  <span className="font-bold block text-neutral-600">Age / Sex:</span>
                  <span className="font-bold text-black">
                    {patient.age ? `${patient.age}Y` : "N/A"} / {patient.gender === "MALE" ? "M" : "F"}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-neutral-600">Phone:</span>
                  <span className="font-mono text-black">{patient.phone || "N/A"}</span>
                </div>
              </div>

              {/* Diagnosis / Chief Complaint (if any) */}
              {diagnosis && (
                <div className="border-b border-dashed border-neutral-400 pb-2">
                  <span className="font-bold text-[10.5px] uppercase text-black block mb-0.5">
                    Chief Complaint / Clinical Diagnosis:
                  </span>
                  <p className="text-[11px] font-semibold text-neutral-900 bg-neutral-50 p-1.5 border border-neutral-200 rounded-xs">
                    {diagnosis}
                  </p>
                </div>
              )}

              {/* Rx Medicines List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 border-b border-black pb-1">
                  <span className="font-serif font-black text-xl italic text-black">℞</span>
                  <span className="font-bold text-xs uppercase tracking-wide text-black">
                    Prescribed Medicines
                  </span>
                </div>

                <div className="space-y-2.5">
                  {medicines.map((med, idx) => (
                    <div
                      key={med.id || idx}
                      className="border-b border-neutral-200 pb-2 flex flex-col gap-1 text-[11px]"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-black text-[12px]">
                          {idx + 1}. {med.name}
                        </span>
                        <span className="font-mono font-bold text-sky-800 text-[11px]">
                          {formatSchedule(med.times)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-neutral-700">
                        <span className="px-1.5 py-0.5 rounded-xs bg-neutral-100 border border-neutral-300 font-bold uppercase text-[9px]">
                          {med.mealTiming === "BEFORE" ? "Before Meal (খাওয়ার আগে)" : "After Meal (খাওয়ার পরে)"}
                        </span>
                        <span>
                          <strong className="text-black">Duration:</strong> {med.duration}
                        </span>
                        {med.instructions && (
                          <span className="italic text-neutral-600">({med.instructions})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advice / Instructions */}
              {advice && (
                <div className="pt-2 border-t border-neutral-300">
                  <span className="font-bold text-[10.5px] uppercase text-black block mb-0.5">
                    Advice / নির্দেশনাবলী:
                  </span>
                  <p className="text-[10px] whitespace-pre-line text-neutral-800 bg-neutral-50 p-2 border border-neutral-200 rounded-xs">
                    {advice}
                  </p>
                </div>
              )}

              {/* Next Follow-Up */}
              {formattedFollowUp && (
                <div className="pt-1 flex items-center justify-between bg-sky-50 p-2 border border-sky-300 rounded-xs text-[10.5px]">
                  <span className="font-bold text-sky-900">Next Follow-Up Date:</span>
                  <span className="font-bold font-mono text-sky-900">{formattedFollowUp}</span>
                </div>
              )}
            </div>

            {/* Bottom Signature Section */}
            <div className="pt-8 flex justify-between items-end border-t border-black text-[9.5px]">
              <div>
                <p className="text-neutral-500 text-[8.5px]">Generated via HPC Clinical System</p>
                <p className="text-neutral-500 text-[8.5px]">
                  Take medicines exactly as prescribed. Keep out of reach of children.
                </p>
              </div>
              <div className="text-center w-36">
                <div className="border-t border-black pt-1">
                  <p className="font-bold text-black">{doctor?.name || "Doctor's Signature"}</p>
                  <p className="text-[8.5px] text-neutral-600">Registered Physician</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
