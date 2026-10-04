"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Download, WifiOff, X } from "lucide-react";

export function PwaRegister() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(false);

  // 1. Service Worker Registration
  React.useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[HPC PWA] Service worker registered with scope:", registration.scope);
          })
          .catch((error) => {
            console.error("[HPC PWA] Service worker registration failed:", error);
          });
      });
    }

    // 2. Offline / Online Status Listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);

    // 3. PWA BeforeInstallPrompt (Android, Chrome, Edge, Smart TV)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install prompt banner after a brief delay if not dismissed
      const dismissed = localStorage.getItem("hpc_pwa_dismissed");
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // 4. Smart TV & Kiosk Screen Wake Lock on Waiting Room TV screen ("/")
  React.useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && pathname === "/") {
          wakeLock = await (navigator as any).wakeLock.request("screen");
          console.log("[HPC Smart TV] Screen wake lock acquired.");
        }
      } catch (err) {
        console.warn("[HPC Smart TV] Wake Lock request error:", err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [pathname]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[HPC PWA] User install choice:", outcome);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("hpc_pwa_dismissed", "true");
  };

  return (
    <>
      {/* Offline / Local LAN Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-xs font-semibold py-1 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="size-3.5" />
          <span>Local LAN Mode: Operating offline on clinic network. Local data and cache active.</span>
        </div>
      )}

      {/* PWA Install Notification Bar */}
      {showInstallBanner && deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-md bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 font-bold text-xs shadow-xs">
              HPC
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">Install HPC App</p>
              <p className="text-[11px] text-slate-300">Install for 1-click desktop or mobile access</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <Download className="size-3" />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismissInstall}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md cursor-pointer transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
