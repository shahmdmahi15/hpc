"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Root Global Error Captured]:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Application Error | Health & Pain Care Center</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
            <AlertTriangle className="size-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              System Error
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              A critical error occurred in the application shell. All offline databases and local services remain intact.
            </p>
          </div>

          {error?.message && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left overflow-hidden">
              <p className="font-mono text-xs text-rose-300 break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="font-mono text-[10px] text-slate-500 mt-1">
                  Digest: #{error.digest.slice(0, 8)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Restart Application</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <span>Waiting Room</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
