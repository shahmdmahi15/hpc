"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw, Stethoscope, Home, AlertCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DoctorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Doctor Desk Error Boundary Captured]:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center py-8 px-3 sm:px-6">
      <div className="max-w-xl w-full rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-lg p-6 sm:p-8 space-y-6">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="size-12 sm:size-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Stethoscope className="size-6 sm:size-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Doctor Chamber Error
              </span>
              {error.digest && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                  #{error.digest.slice(0, 8)}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
              Doctor Consultation Desk Interrupted
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              An unexpected error occurred while managing patient consultations. Your active patient sessions and medical records remain safely stored in the database.
            </p>
          </div>
        </div>

        {/* Technical Error Detail */}
        <div className="p-3.5 rounded-xl bg-muted/60 border border-border/70 space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="size-3 text-destructive" />
              Exception Message
            </span>
            <span className="font-mono text-[10px]">Chamber Route</span>
          </div>
          <p className="font-mono text-xs text-destructive dark:text-red-400 break-words leading-relaxed select-all">
            {error.message || "An unknown doctor consultation error occurred."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="gap-2 rounded-xl font-bold text-xs sm:text-sm h-10 shadow-xs cursor-pointer"
          >
            <RefreshCw className="size-4 animate-spin-reverse" />
            <span>Reload Chamber View</span>
          </Button>

          <div className="flex items-center gap-2">
            <Link
              href="/doctor"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-xl font-semibold text-xs h-10 px-3.5 gap-1.5"
              )}
            >
              <Stethoscope className="size-3.5 text-muted-foreground" />
              <span>Chamber Home</span>
            </Link>

            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "rounded-xl font-semibold text-xs h-10 px-3.5 gap-1.5 text-muted-foreground hover:text-foreground"
              )}
            >
              <Home className="size-3.5" />
              <span>Waiting Room</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
