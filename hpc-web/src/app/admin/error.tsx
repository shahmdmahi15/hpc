"use client";

import * as React from "react";
import Link from "next/link";
import {
  RefreshCw,
  ShieldAlert,
  LayoutDashboard,
  FileText,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Admin Module Error Boundary Captured]:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center py-8 px-2 sm:px-4">
      <div className="max-w-xl w-full rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-lg p-6 sm:p-8 space-y-6">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="size-12 sm:size-14 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="size-6 sm:size-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/20">
                Admin Console Error
              </span>
              {error.digest && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                  #{error.digest.slice(0, 8)}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
              Administrative Operation Failed
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              An unexpected error occurred while rendering this administrative view. Your administrator credentials and session remain secure.
            </p>
          </div>
        </div>

        {/* Technical Error Detail */}
        <div className="p-3.5 rounded-xl bg-muted/60 border border-border/70 space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Exception Message</span>
            <span className="font-mono text-[10px]">Isolated Route Error</span>
          </div>
          <p className="font-mono text-xs text-destructive dark:text-red-400 break-words leading-relaxed select-all">
            {error.message || "An unknown administrative error occurred."}
          </p>
          {error.digest && (
            <p className="font-mono text-[10.5px] text-muted-foreground pt-1 border-t border-border/50">
              Server Digest ID: <span className="text-foreground">{error.digest}</span>
            </p>
          )}
        </div>

        {/* Actions - Strictly staying within /admin */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => reset()}
              className="gap-2 font-bold cursor-pointer rounded-xl text-xs sm:text-sm h-10 px-4 shadow-xs"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry Operation</span>
            </Button>

            <Link
              href="/admin"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "gap-2 font-semibold rounded-xl text-xs sm:text-sm h-10 px-4 border-border/80 hover:bg-muted"
              )}
            >
              <LayoutDashboard className="size-3.5 text-primary" />
              <span>Admin Dashboard</span>
            </Link>
          </div>

          <Link
            href="/admin/audit"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center justify-center sm:justify-start gap-1.5 transition-colors py-2"
          >
            <FileText className="size-3.5" />
            <span>View Audit Logs</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
