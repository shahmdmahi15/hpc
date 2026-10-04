"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Next.js App Error Boundary Captured]:", error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4 text-foreground">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-lg text-center space-y-5">
        <div className="size-14 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 mx-auto flex items-center justify-center">
          <AlertCircle className="size-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            The page encountered a temporary issue while loading. Please retry or return to the main waiting room.
          </p>
        </div>

        {error?.message && (
          <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-left overflow-hidden">
            <p className="font-mono text-[11px] text-muted-foreground truncate">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span>Reload Page</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Home className="size-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
