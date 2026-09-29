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
import { Printer, FileText, Activity, Stethoscope, Download, Loader2 } from "lucide-react";
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
        format: "a4",
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
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span>Clinical Assessment Report &amp; Prescription</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Scrollable A4 Document Preview */}
        <div className="p-6 max-h-[80vh] overflow-y-auto bg-neutral-100 dark:bg-neutral-900/60 flex justify-center">
          <div
            id="doctor-prescription-print"
            className="w-full max-w-[720px] bg-white text-black p-8 rounded-sm shadow-md border border-neutral-300 font-sans text-xs leading-normal"
          >
            {/* 1. Formal Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-primary pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-black text-sm">
                    {CLINIC_CONFIG.shortName}
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-neutral-900 uppercase">
                      {CLINIC_CONFIG.name}
                    </h1>
                    <p className="text-[10.5px] font-semibold text-neutral-600 uppercase tracking-wider">
                      {CLINIC_CONFIG.tagline}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1 font-medium">
                  {CLINIC_CONFIG.fullLocation} • Hotline: {CLINIC_CONFIG.phone}
                </p>
              </div>

              <div className="text-right text-[10px]">
                <p className="font-bold text-neutral-800">
                  {doctor?.name || "Consultant Physiotherapist"}
                </p>
                <p className="text-neutral-500">MPT, BPT (Physical Therapy)</p>
                <p className="text-neutral-500">Reg No: BMDC / BPA-9842</p>
              </div>
            </div>

            {/* 2. Patient Demographics Strip */}
            <div className="bg-neutral-50 border border-neutral-200 rounded p-3 mb-4 grid grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-neutral-500 block text-[9.5px]">Patient Name</span>
                <span className="font-bold text-neutral-900">{patient.name}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[9.5px]">MRN (Record No)</span>
                <span className="font-mono font-bold text-neutral-900">
                  {patient.mrn || "HPC-PT-001"}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[9.5px]">Age / Gender</span>
                <span className="font-semibold text-neutral-900">
                  {patient.age ? `${patient.age} Yrs` : "N/A"} • {patient.gender}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[9.5px]">Assessment Date</span>
                <span className="font-semibold text-neutral-900">{assessmentDate}</span>
              </div>
            </div>

            {/* 3. Clinical Findings & Pain Assessment */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Left Column: Complaints & History */}
              <div className="border border-neutral-200 rounded p-3 space-y-2">
                <h3 className="font-bold text-[11.5px] uppercase tracking-wide text-neutral-800 border-b pb-1 flex items-center gap-1.5">
                  <Activity className="size-3 text-sky-600" />
                  Clinical Pain Profile
                </h3>

                <div>
                  <span className="text-neutral-500 text-[10px] block">Chief Pain Areas:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {parsedPainAreas.length > 0 ? (
                      parsedPainAreas.map((area) => (
                        <span
                          key={area}
                          className="px-1.5 py-0.5 bg-neutral-200 text-neutral-800 rounded text-[10px] font-semibold"
                        >
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="text-neutral-700 italic">None specified</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-neutral-500 block">Side:</span>
                    <span className="font-semibold">{record?.painSide || "Bilateral"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Duration:</span>
                    <span className="font-semibold">{record?.duration || "N/A"}</span>
                  </div>
                </div>

                {/* VAS Score Box */}
                <div className="p-2 bg-neutral-100 rounded flex items-center justify-between border border-neutral-200">
                  <span className="font-bold text-[10.5px]">VAS Pain Score (0 - 10):</span>
                  <div className="flex items-center gap-1.5 font-bold font-mono">
                    <span className="text-base text-red-600 font-black">
                      {record?.vasScore ?? 6}/10
                    </span>
                    <span className="text-[9px] text-neutral-500 font-normal">
                      ({(record?.vasScore ?? 6) >= 7 ? "Severe" : (record?.vasScore ?? 6) >= 4 ? "Moderate" : "Mild"})
                    </span>
                  </div>
                </div>

                {parsedLimitations.length > 0 && (
                  <div>
                    <span className="text-neutral-500 text-[10px] block">Functional Limitations:</span>
                    <p className="text-[10px] font-medium text-neutral-800">
                      {parsedLimitations.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Physical Examination */}
              <div className="border border-neutral-200 rounded p-3 space-y-2">
                <h3 className="font-bold text-[11.5px] uppercase tracking-wide text-neutral-800 border-b pb-1 flex items-center gap-1.5">
                  <Stethoscope className="size-3 text-sky-600" />
                  Physical Examination
                </h3>

                <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                  <div>
                    <span className="text-neutral-500 block text-[10px]">ROM:</span>
                    <span className="font-semibold">{record?.rom || "Restricted"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Muscle Spasm:</span>
                    <span className="font-semibold">{record?.muscleSpasm ? "Present (+)" : "Absent (-)"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Tenderness:</span>
                    <span className="font-semibold">{record?.tenderness ? "Present (+)" : "Absent (-)"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Swelling:</span>
                    <span className="font-semibold">{record?.swelling ? "Present (+)" : "Absent (-)"}</span>
                  </div>
                </div>

                {record?.physicalExamNotes && (
                  <div>
                    <span className="text-neutral-500 text-[10px] block">Clinical Notes:</span>
                    <p className="text-[10px] italic text-neutral-700">
                      {record.physicalExamNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Diagnosis Banner */}
            <div className="bg-sky-50 border border-sky-200 rounded p-3 mb-4">
              <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                Clinical Diagnosis
              </span>
              <p className="text-sm font-extrabold text-neutral-900 mt-0.5">
                {diagnosis}
              </p>
            </div>

            {/* 5. Prescribed Treatment Plan & Modalities */}
            <div className="border border-neutral-300 rounded p-3 mb-4">
              <h3 className="font-black text-xs uppercase tracking-wide text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                ℞ Prescribed Physical Therapy Modalities
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {parsedTreatments.length > 0 ? (
                  parsedTreatments.map((modality, idx) => (
                    <div
                      key={modality}
                      className="flex items-center gap-2 p-2 bg-neutral-50 rounded border border-neutral-200 text-[11px]"
                    >
                      <span className="size-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-neutral-800">{modality}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-neutral-500 italic col-span-2">
                    Standard Conservative Physiotherapy Protocol prescribed.
                  </p>
                )}
              </div>

              {record?.treatmentNotes && (
                <div className="mt-2.5 pt-2 border-t border-neutral-200 text-[10.5px]">
                  <span className="font-bold text-neutral-700">Therapist Protocol Instructions:</span>
                  <p className="text-neutral-800 mt-0.5">{record.treatmentNotes}</p>
                </div>
              )}
            </div>

            {/* 6. Home Advice & Guidelines */}
            <div className="border border-dashed border-neutral-300 rounded p-3 mb-6 bg-neutral-50/50 text-[10.5px]">
              <span className="font-bold text-neutral-800 block text-[11px]">
                Home Advice &amp; Posture Care:
              </span>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-neutral-700 text-[10px]">
                <li>Avoid prolonged sitting, forward bending, and lifting heavy weights.</li>
                <li>Apply warm compress / hot water bag for 15-20 minutes before sleeping.</li>
                <li>Perform gentle prescribed mobility exercises twice daily without straining.</li>
                <li>Maintain ergonomic spinal posture with lumbar back support while sitting.</li>
              </ul>
            </div>

            {/* 7. Footer & Signature */}
            <div className="flex justify-between items-end pt-6 border-t border-neutral-300">
              <div className="text-[9.5px] text-neutral-500 space-y-0.5">
                <p>System Generated Clinical Record • Valid with Doctor Signature</p>
                <p>Health &amp; Pain Care Center Management System</p>
              </div>

              <div className="text-center w-48">
                <div className="h-10 border-b border-black mb-1 flex items-end justify-center">
                  <span className="font-serif italic text-sm text-neutral-700">
                    {doctor?.name || "Dr. M. Rahman"}
                  </span>
                </div>
                <p className="font-bold text-[10px] text-neutral-900">
                  {doctor?.name || "Attending Physiotherapist"}
                </p>
                <p className="text-[9px] text-neutral-600">Consultant / Clinical Head</p>
              </div>
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
              className="gap-1.5 font-semibold cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              <span>Download PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Print Prescription (A4)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
