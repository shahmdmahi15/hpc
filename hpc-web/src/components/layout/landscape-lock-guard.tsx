"use client";

import * as React from "react";
import { Smartphone, RotateCcw, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LandscapeLockGuard() {
  const { lang } = useI18n();
  const [isPortrait, setIsPortrait] = React.useState<boolean>(false);
  const [isDismissed, setIsDismissed] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Attempt standard Screen Orientation API lock if supported (PWA/Standalone)
    const tryLockLandscape = async () => {
      try {
        if (
          typeof window !== "undefined" &&
          "screen" in window &&
          "orientation" in window.screen &&
          // @ts-ignore
          typeof window.screen.orientation.lock === "function"
        ) {
          // @ts-ignore
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      } catch {
        // Ignored if browser requires fullscreen before orientation lock
      }
    };

    tryLockLandscape();

    // Check media query for portrait orientation on mobile / tablet screens
    const mediaQuery = window.matchMedia(
      "(orientation: portrait) and (max-width: 1024px)",
    );

    const updateOrientation = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsPortrait(e.matches);
    };

    updateOrientation(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateOrientation);
      return () => mediaQuery.removeEventListener("change", updateOrientation);
    } else {
      // @ts-ignore
      mediaQuery.addListener(updateOrientation);
      // @ts-ignore
      return () => mediaQuery.removeListener(updateOrientation);
    }
  }, []);

  const handleRequestLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (
        "screen" in window &&
        "orientation" in window.screen &&
        // @ts-ignore
        typeof window.screen.orientation.lock === "function"
      ) {
        // @ts-ignore
        await window.screen.orientation.lock("landscape");
      }
    } catch {
      // Ignore
    }
  };

  if (!isPortrait || isDismissed) {
    return null;
  }

  const isBn = lang === "bn";

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-4 sm:bottom-4 z-[9999] pointer-events-auto max-w-md animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/95 text-white border-2 border-emerald-500/80 shadow-2xl backdrop-blur-xl flex items-start gap-3.5 ring-4 ring-emerald-500/20">
        {/* Animated Rotating Phone Icon */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
          <Smartphone className="size-6 animate-pulse rotate-90 transition-transform duration-700" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>{isBn ? "ল্যান্ডস্কেপ মোড আবশ্যক" : "Landscape Mode Recommended"}</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              title={isBn ? "বন্ধ করুন" : "Dismiss"}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-300 leading-snug">
            {isBn
              ? "হাসপাতাল সিরিয়াল ও ক্লিনিক্যাল ছকগুলো স্পষ্টভাবে দেখতে আপনার ডিভাইসটি আড়াআড়ি (Landscape) ঘুরিয়ে নিন।"
              : "Please rotate your phone or tablet to landscape orientation for optimal clinical and queue visibility."}
          </p>

          <div className="pt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestLandscape}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold tracking-wide flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <RotateCcw className="size-3" />
              <span>{isBn ? "স্বয়ংক্রিয় ল্যান্ডস্কেপ" : "Force Landscape"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[10.5px] font-medium transition-all cursor-pointer"
            >
              {isBn ? "এভাবেই থাকুক" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
