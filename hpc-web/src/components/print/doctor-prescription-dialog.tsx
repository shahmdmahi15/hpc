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
import { Printer, FileText, Activity, Stethoscope, Download, Loader2, Phone, MapPin } from "lucide-react";
import type { MedicalRecordModel, PatientModel, PerformerModel, UserModel } from "@/generated/prisma/models";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";

export interface DoctorPrescriptionData {
  patient: PatientModel;
  doctor?: (UserModel | PerformerModel | { name?: string | null; email?: string | null; whatsapp?: string | null; phone?: string | null }) | null;
  record?: MedicalRecordModel | null;
  treatmentPlans?: string[];
  diagnosis?: string;
  notes?: string;
}

interface DoctorPrescriptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: DoctorPrescriptionData | null;
}

export function DoctorPrescriptionDialog({
  isOpen,
  onOpenChange,
  data,
}: DoctorPrescriptionDialogProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  const handlePrint = () => {
    printElementIsolated("doctor-prescription-print", `Prescription - ${data?.patient?.name || "Patient"}`);
  };

  const handleDownloadPdf = async () => {
    if (!data?.patient) return;
    setIsGeneratingPdf(true);
    const patientSlug = data.patient.name.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `HPC-Prescription-${data.patient.mrn || "PT"}-${patientSlug}.pdf`;

    try {
      const success = await downloadElementAsPdf("doctor-prescription-print", {
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
      console.error("[Prescription PDF] Error:", e);
      toast.error("Error creating prescription PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!data || !data.patient) return null;

  const { patient, doctor, record } = data;
  const assessmentDate = record?.assessmentDate
    ? new Date(record.assessmentDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  let parsedPainAreas: string[] = [];
  let parsedPainTypes: string[] = [];
  let parsedTreatments: string[] = [];
  let parsedAggravating: string[] = [];
  let parsedRelieving: string[] = [];
  let parsedLimitations: string[] = [];

  try {
    if (record?.painAreas) parsedPainAreas = JSON.parse(record.painAreas);
    if (record?.painTypes) parsedPainTypes = JSON.parse(record.painTypes);
    if (record?.treatmentPlans) parsedTreatments = JSON.parse(record.treatmentPlans);
    if (record?.aggravatingFactors) parsedAggravating = JSON.parse(record.aggravatingFactors);
    if (record?.relievingFactors) parsedRelieving = JSON.parse(record.relievingFactors);
    if (record?.functionalLimitations) parsedLimitations = JSON.parse(record.functionalLimitations);
  } catch {
    // Fallback if not valid JSON
  }

  if (data.treatmentPlans && data.treatmentPlans.length > 0) {
    parsedTreatments = Array.from(new Set([...parsedTreatments, ...data.treatmentPlans]));
  }

  const diagnosis = data.diagnosis || record?.diagnosis || "Mechanical Musculoskeletal Pain";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[86vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span>Clinical Assessment Report &amp; Prescription</span>
            </DialogTitle>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border self-start sm:self-auto">
              5.5″ × 8.27″ (HPC Paper)
            </span>
          </div>
        </DialogHeader>

        {/* Scrollable Document Preview (Formatted for 5.5" x 8.27" custom Wi-Fi paper) */}
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto overflow-x-hidden bg-neutral-200/70 dark:bg-neutral-950 flex justify-center">
          <div
            id="doctor-prescription-print"
            className="w-full max-w-[520px] min-h-[750px] bg-white text-black p-4 sm:p-5 rounded-xs border border-black font-sans text-xs leading-normal shadow-xl flex flex-col justify-between"
          >
            {/* Top Section */}
            <div className="space-y-2.5">
              {/* 1. Formal Letterhead with Official Logo */}
              <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.jpg"
                  alt="Health & Pain Care Center Logo"
                  className="size-14 sm:size-15 object-contain shrink-0"
                />
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-black uppercase leading-tight">
                    {CLINIC_CONFIG.name}
                  </h1>
                  <p className="text-[10.5px] font-bold text-neutral-800 tracking-wide">
                    {CLINIC_CONFIG.nameBangla}
                  </p>
                  <p className="text-[9.5px] font-medium text-neutral-600 pt-0.5">
                    {CLINIC_CONFIG.tagline}
                  </p>
                </div>
              </div>

              <div className="text-right text-[9.5px] text-neutral-800 space-y-0.5">
                <p className="font-black text-black text-[10.5px]">
                  {doctor?.name || "Consultant Physiotherapist"}
                </p>
                <p className="text-neutral-700 font-medium">MPT, BPT (Physical Therapy)</p>
                <p className="text-neutral-600 font-mono">Reg: BMDC / BPA Specialist</p>
                <div className="flex items-center justify-end gap-1 font-bold text-black pt-0.5">
                  <Phone className="size-2.5 text-black" />
                  <span>Hotline: {CLINIC_CONFIG.phone}</span>
                </div>
              </div>
            </div>

            {/* Document Header Bar */}
            <div className="flex items-center justify-between border-y border-black py-1 mb-2.5 bg-neutral-50 print:bg-white">
              <div className="flex items-center gap-2">
                <span className="bg-black text-white font-black text-[9.5px] tracking-wider uppercase px-2 py-0.5 rounded-xs">
                  CLINICAL PRESCRIPTION &amp; ASSESSMENT
                </span>
                <span className="text-[10.5px] font-bold text-black">
                  ব্যবস্থাপত্র ও স্বাস্থ্য মূল্যায়ন
                </span>
              </div>
              <div className="text-[10px] text-right font-mono font-bold text-black">
                {assessmentDate}
              </div>
            </div>

            {/* 2. Patient Demographics Strip */}
            <div className="bg-white border border-neutral-800 rounded-xs p-2.5 mb-2.5 grid grid-cols-4 gap-2 text-[10.5px]">
              <div>
                <span className="text-neutral-600 block text-[9.5px] font-medium">Patient Name:</span>
                <span className="font-bold text-black uppercase truncate block">{patient.name}</span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[9.5px] font-medium">MRN (ID):</span>
                <span className="font-mono font-bold text-black block">
                  {patient.mrn || "HPC-PT-001"}
                </span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[9.5px] font-medium">Age / Gender:</span>
                <span className="font-semibold text-black block">
                  {patient.age ? `${patient.age} Yrs` : "N/A"} • {patient.gender}
                </span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[9.5px] font-medium">Contact Phone:</span>
                <span className="font-mono font-semibold text-black block">
                  {patient.phone || "N/A"}
                </span>
              </div>
            </div>

            {/* 3. Clinical Findings & Pain Assessment */}
            <div className="grid grid-cols-2 gap-3 mb-2.5">
              {/* Left Column: Complaints & History */}
              <div className="border border-black rounded-xs p-2.5 space-y-1.5 bg-white">
                <h3 className="font-black text-[10.5px] uppercase tracking-wide text-black border-b border-black pb-1 flex items-center justify-between">
                  <span>Clinical Pain Profile</span>
                  <Activity className="size-3 text-black" />
                </h3>

                <div>
                  <span className="text-neutral-600 text-[9.5px] block font-medium">Chief Pain Areas:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {parsedPainAreas.length > 0 ? (
                      parsedPainAreas.map((area) => (
                        <span
                          key={area}
                          className="px-1.5 py-0.5 bg-neutral-100 text-black border border-neutral-400 rounded-xs text-[9.5px] font-bold"
                        >
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="text-neutral-600 italic text-[9.5px]">None specified</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                  <div>
                    <span className="text-neutral-600 block font-medium">Side:</span>
                    <span className="font-bold text-black">{record?.painSide || "Bilateral"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600 block font-medium">Duration:</span>
                    <span className="font-bold text-black">{record?.duration || "N/A"}</span>
                  </div>
                </div>

                {/* VAS Score Box */}
                <div className="p-1.5 bg-neutral-50 rounded-xs flex items-center justify-between border border-neutral-700">
                  <span className="font-bold text-[10px] text-black">VAS Pain Score (0-10):</span>
                  <div className="flex items-center gap-1 font-bold font-mono">
                    <span className="text-sm text-black font-black">
                      {record?.vasScore ?? 6}/10
                    </span>
                    <span className="text-[9px] text-neutral-700 font-normal">
                      ({(record?.vasScore ?? 6) >= 7 ? "Severe" : (record?.vasScore ?? 6) >= 4 ? "Moderate" : "Mild"})
                    </span>
                  </div>
                </div>

                {parsedLimitations.length > 0 && (
                  <div>
                    <span className="text-neutral-600 text-[9.5px] block font-medium">Limitations:</span>
                    <p className="text-[9.5px] font-medium text-neutral-800 leading-tight">
                      {parsedLimitations.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Physical Examination */}
              <div className="border border-black rounded-xs p-2.5 space-y-1.5 bg-white">
                <h3 className="font-black text-[10.5px] uppercase tracking-wide text-black border-b border-black pb-1 flex items-center justify-between">
                  <span>Physical Examination</span>
                  <Stethoscope className="size-3 text-black" />
                </h3>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-neutral-600 block text-[9.5px] font-medium">ROM:</span>
                    <span className="font-bold text-black">{record?.rom || "Restricted"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600 block text-[9.5px] font-medium">Spasm:</span>
                    <span className="font-bold text-black">{record?.muscleSpasm ? "Present (+)" : "Absent (-)"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600 block text-[9.5px] font-medium">Tenderness:</span>
                    <span className="font-bold text-black">{record?.tenderness ? "Present (+)" : "Absent (-)"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600 block text-[9.5px] font-medium">Swelling:</span>
                    <span className="font-bold text-black">{record?.swelling ? "Present (+)" : "Absent (-)"}</span>
                  </div>
                </div>

                {record?.physicalExamNotes && (
                  <div className="pt-1 border-t border-neutral-200">
                    <span className="text-neutral-600 text-[9.5px] block font-medium">Clinical Notes:</span>
                    <p className="text-[9.5px] italic text-neutral-800 leading-tight">
                      {record.physicalExamNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Diagnosis Banner (Crisp B&W Boxed Banner) */}
            <div className="border-2 border-black rounded-xs p-2.5 mb-2.5 bg-neutral-50 print:bg-white">
              <span className="text-[9.5px] font-black text-black uppercase tracking-wider block">
                PROVISIONAL CLINICAL DIAGNOSIS / রোগ নির্ণয়:
              </span>
              <p className="text-sm font-black text-black mt-0.5">
                {diagnosis}
              </p>
            </div>

            {/* 5. Prescribed Treatment Plan & Modalities */}
            <div className="border border-black rounded-xs p-2.5 mb-2.5 bg-white">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
                <h3 className="font-black text-xs uppercase tracking-wide text-black">
                  ℞ Prescribed Physical Therapy Modalities (থেরাপি প্রেসক্রিপশন)
                </h3>
                <span className="text-[9.5px] font-mono font-bold text-neutral-600">
                  {parsedTreatments.length} Modalities
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {parsedTreatments.length > 0 ? (
                  parsedTreatments.map((modality, idx) => (
                    <div
                      key={modality}
                      className="flex items-center gap-2 p-1.5 bg-white rounded-xs border border-neutral-800 text-[10.5px]"
                    >
                      <span className="size-4.5 rounded-full bg-black text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-black">{modality}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-neutral-600 italic col-span-2">
                    Standard Conservative Physiotherapy Protocol prescribed.
                  </p>
                )}
              </div>

              {record?.treatmentNotes && (
                <div className="mt-2 pt-1.5 border-t border-neutral-300 text-[10px]">
                  <span className="font-bold text-black">Therapist Protocol Instructions:</span>
                  <p className="text-neutral-800 mt-0.5">{record.treatmentNotes}</p>
                </div>
              )}
            </div>

            {/* 6. Home Advice & Guidelines */}
            <div className="border border-neutral-800 rounded-xs p-2.5 mb-3 bg-white text-[10px]">
              <span className="font-black text-black block text-[10.5px] uppercase tracking-wide">
                Home Advice &amp; Posture Care (গৃহ নির্দেশিকা):
              </span>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-neutral-800 text-[9.5px]">
                <li>Avoid prolonged sitting, forward bending, and lifting heavy weights without support.</li>
                <li>Apply warm compress / hot water bag for 15-20 minutes before sleeping.</li>
                <li>Perform gentle prescribed mobility exercises twice daily without straining.</li>
                <li>Maintain ergonomic spinal posture with lumbar back support while sitting.</li>
              </ul>
            </div>
            </div>

            {/* Flexible Spacer */}
            <div className="flex-1 min-h-4"></div>

            {/* 7. Footer & Signature */}
            <div className="flex justify-between items-end pt-3 border-t border-black">
              <div className="text-[8.5px] text-neutral-600 space-y-0.5">
                <p className="font-bold text-black">Health &amp; Pain Care Center Management System</p>
                <p>{CLINIC_CONFIG.fullLocation}</p>
                <p>System Generated Official Clinical Document • Valid with Specialist Signature</p>
              </div>

              <div className="text-center w-48">
                <div className="h-9 border-b border-black mb-1 flex items-end justify-center">
                  <span className="font-serif italic text-sm text-black">
                    {doctor?.name || "Dr. M. Rahman"}
                  </span>
                </div>
                <p className="font-bold text-[10px] text-black">
                  {doctor?.name || "Attending Physiotherapist"}
                </p>
                <p className="text-[8.5px] text-neutral-600">Consultant / Clinical Head</p>
              </div>
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
              className="gap-1.5 font-semibold cursor-pointer flex-1 sm:flex-initial"
            >
              {isGeneratingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              <span>Download PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs flex-1 sm:flex-initial"
            >
              <Printer className="size-3.5" />
              <span>Print Prescription (5.5″ × 8.125″)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
