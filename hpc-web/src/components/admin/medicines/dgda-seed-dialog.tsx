"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Sparkles,
  Layers,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { seedDgdaMedicinesAction } from "@/actions/admin/medicine.action";
import { toast } from "sonner";

interface DgdaSeedDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  onSuccess: () => void;
}

export function DgdaSeedDialog({
  isOpen,
  onOpenChange,
  currentCount,
  onSuccess,
}: DgdaSeedDialogProps) {
  const [loadingMode, setLoadingMode] = React.useState<"all" | "generics" | "brands" | null>(null);

  const handleSeed = async (mode: "all" | "generics" | "brands") => {
    setLoadingMode(mode);
    try {
      const modeLabel =
        mode === "all"
          ? "Full DGDA Master Catalog"
          : mode === "generics"
            ? "DGDA Generics"
            : "Commercial Brands";

      toast.loading(`Seeding ${modeLabel} from Bangladesh Drug Administration CSV files...`, {
        id: "dgda-seed-toast",
      });

      const res = await seedDgdaMedicinesAction(mode);

      if (res.success) {
        toast.success(res.message, { id: "dgda-seed-toast", duration: 8000 });
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(res.message || "Seeding failed.", { id: "dgda-seed-toast" });
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred during seeding.", {
        id: "dgda-seed-toast",
      });
    } finally {
      setLoadingMode(null);
    }
  };

  const isBusy = loadingMode !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isBusy && onOpenChange(open)}>
      <DialogContent className="max-w-2xl bg-background border-border shadow-2xl p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-5 border-b border-border/80 bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-600/20">
                <Database className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <span>DGDA Bangladesh Medicine Directory Seeding</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                    Official DGDA Data
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Direct ingestion from Directorate General of Drug Administration (DGDA) official files in <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">prisma/</code>.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 text-xs">
          {/* Current Status Pill */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span className="font-semibold text-foreground">Current Live Clinic Catalog:</span>
            </div>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
              {currentCount.toLocaleString()} medicines active
            </span>
          </div>

          {/* Dataset Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* File 1: DGDA Generics */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <FileSpreadsheet className="size-3.5 text-sky-600" />
                  <span>dgda.csv</span>
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  3,599 Generics
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Official National Generic Drug List of Bangladesh with standardized dosage forms (Tablet, Capsule, Syrup, Injection) and clinical strengths.
              </p>
              <div className="text-[10.5px] text-sky-700 dark:text-sky-300 font-medium">
                Enables prescribing by Generic Name (e.g. Tab. Paracetamol 500 mg).
              </div>
            </div>

            {/* File 2: Commercial Brands Export */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <Building2 className="size-3.5 text-purple-600" />
                  <span>medicine_export.csv</span>
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  41,302 Trade Brands
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Complete commercial brands registry across 344 pharmaceutical companies (Square, Beximco, Incepta, Renata, ACI, ACME, Opsonin, etc.).
              </p>
              <div className="text-[10.5px] text-purple-700 dark:text-purple-300 font-medium">
                Enables prescribing commercial brands (e.g. Napa, Seclo, Maxpro).
              </div>
            </div>
          </div>

          {/* Intelligent Features Notice */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-muted-foreground space-y-1">
            <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-600" />
              <span>Smart Seeding &amp; Clinical Automation Features</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10.5px]">
              <li><strong>Zero Duplicates:</strong> Smart name disambiguation ensures 100% uniqueness with zero constraint collisions.</li>
              <li><strong>Clinical Presets:</strong> PPIs (Omeprazole, etc.) preset to &quot;BEFORE meal&quot;, NSAIDs/painkillers to &quot;AFTER meal&quot;, and Pregabalin to &quot;NIGHT&quot;.</li>
              <li><strong>Instant Performance:</strong> Batched transaction ingestion completes in seconds with SQLite WAL mode.</li>
            </ul>
          </div>

          {/* Action Options */}
          <div className="space-y-2 pt-1">
            {/* 1. Master Seed (Both) */}
            <Button
              className="w-full justify-between h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md cursor-pointer"
              disabled={isBusy}
              onClick={() => handleSeed("all")}
            >
              <span className="flex items-center gap-2">
                {loadingMode === "all" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Database className="size-4" />
                )}
                <span>Seed Full DGDA Master Catalog (Generics + Commercial Brands)</span>
              </span>
              <span className="font-mono text-[11px] opacity-90">~44,700 items</span>
            </Button>

            {/* Individual Sub-Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-between h-9 text-xs font-semibold cursor-pointer border-sky-500/30 hover:bg-sky-500/10"
                disabled={isBusy}
                onClick={() => handleSeed("generics")}
              >
                <span className="flex items-center gap-1.5">
                  {loadingMode === "generics" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-3.5 text-sky-600" />
                  )}
                  <span>Seed DGDA Generics Only</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">~3,500</span>
              </Button>

              <Button
                variant="outline"
                className="justify-between h-9 text-xs font-semibold cursor-pointer border-purple-500/30 hover:bg-purple-500/10"
                disabled={isBusy}
                onClick={() => handleSeed("brands")}
              >
                <span className="flex items-center gap-1.5">
                  {loadingMode === "brands" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Building2 className="size-3.5 text-purple-600" />
                  )}
                  <span>Seed Commercial Brands Only</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">~41,300</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
