"use client";

import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { LanguageSwitcher } from "@/lib/i18n";
import { useLiveClock } from "@/hooks/use-live-clock";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import {
  getLiveQueueAction,
  type AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import { evaluatePunctuality, formatTime12h } from "@/lib/queue-punctuality";
import { Role } from "@/generated/prisma/enums";
import { getRoleDashboard } from "@/proxy";
import {
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  DoorOpen,
  Wifi,
  WifiOff,
  Activity,
  Stethoscope,
  Volume2,
  Megaphone,
  LogIn,
  ClipboardList,
  CreditCard,
  Shield,
  Radio,
} from "lucide-react";

interface DoctorCallAnnouncement {
  appointmentId: string;
  patientName: string;
  gender?: string;
  roomNumber: string;
  roomPurpose?: string;
  timestamp: string;
}

interface WaitingRoomLiveQueueViewProps {
  initialQueue: AppointmentWithRelations[];
  initialDate: string;
  currentUser?: { role: Role } | null;
}

export function WaitingRoomLiveQueueView({
  initialQueue,
  initialDate,
  currentUser,
}: WaitingRoomLiveQueueViewProps) {
  const [queue, setQueue] =
    React.useState<AppointmentWithRelations[]>(initialQueue);
  const [activeAnnouncement, setActiveAnnouncement] =
    React.useState<DoctorCallAnnouncement | null>(null);
  const [countdownSeconds, setCountdownSeconds] = React.useState<number>(16);

  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const currentTime = useLiveClock();
  const [, startTransition] = React.useTransition();

  // Safely get or create persistent AudioContext for kiosk mode
  const getAudioContext = React.useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return null;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  // Auto-activate audio context on mount for unattended kiosk display
  React.useEffect(() => {
    getAudioContext();
  }, [getAudioContext]);

  // Play rich resonant dual hospital bell chime (Ding-Dong) using native Web Audio API (100% offline)
  const playDoctorCallChime = React.useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      // Chord 1 (Ding) at t=0.0s: Harmonic C5 bell chord
      // Chord 2 (Dong) at t=0.55s: Resonant G4 lower bell chord
      const bellNotes = [
        // Ding
        { freq: 523.25, start: 0.0, duration: 0.85, peakGain: 0.45 },
        { freq: 659.25, start: 0.0, duration: 0.7, peakGain: 0.3 },
        { freq: 783.99, start: 0.0, duration: 0.9, peakGain: 0.35 },
        // Dong
        { freq: 392.0, start: 0.55, duration: 1.4, peakGain: 0.55 },
        { freq: 493.88, start: 0.55, duration: 1.2, peakGain: 0.35 },
        { freq: 587.33, start: 0.55, duration: 1.5, peakGain: 0.4 },
      ];

      bellNotes.forEach(({ freq, start, duration, peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gainNode.gain.exponentialRampToValueAtTime(
          peakGain,
          ctx.currentTime + start + 0.025,
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + start + duration,
        );

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      });
    } catch (err) {
      console.warn("[Doctor Call Chime Error]:", err);
    }
  }, [getAudioContext]);

  // Broadcast both audible chime and clear speech synthesis voice announcement
  const playAnnouncementSound = React.useCallback(
    (announcement: DoctorCallAnnouncement) => {
      // 1. Trigger resonant airport/hospital chime
      playDoctorCallChime();

      // 2. Trigger clear spoken text-to-speech announcement (offline native browser API)
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          setTimeout(() => {
            try {
              const text = `Attention please. Patient ${announcement.patientName}. Please proceed to Room ${announcement.roomNumber}.`;
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.rate = 0.88; // steady clear cadence
              utterance.pitch = 1.0;
              utterance.volume = 1.0;
              window.speechSynthesis.speak(utterance);
            } catch (e) {
              console.warn("[Speech Synthesis Error]:", e);
            }
          }, 1100);
        } catch (err) {
          console.warn("[Speech Synthesis Cancel Error]:", err);
        }
      }
    },
    [playDoctorCallChime],
  );

  const refreshQueue = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getLiveQueueAction();
        if (res.success) {
          setQueue(res.queue);
        }
      } catch (err) {
        console.error("[Waiting Room Queue Refresh Error]:", err);
      }
    });
  }, []);

  // Real-time SSE subscription (100% offline local network sync)
  const { connectionStatus } = useRealtimeEvents({
    onEvent: (event) => {
      if (event.type === "DOCTOR_CALLED") {
        const announcementData = event.data as DoctorCallAnnouncement;
        setActiveAnnouncement(announcementData);
        setCountdownSeconds(16);
        playAnnouncementSound(announcementData);
        refreshQueue();
      } else if (
        event.type === "APPOINTMENT_UPDATED" ||
        event.type === "APPOINTMENT_CREATED" ||
        event.type === "APPOINTMENT_CANCELLED"
      ) {
        if (event.type === "APPOINTMENT_UPDATED" && event.data?.id) {
          const d = event.data;
          setQueue((prevQueue) =>
            prevQueue.map((item) => {
              if (item.id === d.id) {
                return {
                  ...item,
                  ...(d.willCallTime !== undefined
                    ? { willCallTime: d.willCallTime }
                    : {}),
                  ...(d.status !== undefined ? { status: d.status } : {}),
                  ...(d.queueType !== undefined
                    ? { queueType: d.queueType }
                    : {}),
                  ...(d.roomNumber !== undefined
                    ? {
                        room:
                          d.roomNumber && item.room
                            ? { ...item.room, number: d.roomNumber }
                            : item.room,
                      }
                    : {}),
                };
              }
              return item;
            }),
          );
        }
        refreshQueue();
      }
    },
  });

  // Countdown timer for announcement auto-dismiss
  React.useEffect(() => {
    if (!activeAnnouncement) return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          setActiveAnnouncement(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAnnouncement]);

  // Safety periodic poll (every 30s)
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  // Formatted digital clock strings
  const formattedTime = currentTime
    ? currentTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  const formattedDate = currentTime
    ? currentTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : initialDate;

  // Split queue into 2 distinct columns: Therapy Queue & Consultation Queue
  const therapyQueue = React.useMemo(() => {
    return queue.filter((item) => (item.queueType || "THERAPY") === "THERAPY");
  }, [queue]);

  const consultationQueue = React.useMemo(() => {
    return queue.filter((item) => item.queueType === "CONSULTATION");
  }, [queue]);

  // Queue Punctuality Statistics
  const stats = React.useMemo(() => {
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    for (const item of queue) {
      const p = evaluatePunctuality(item.toldTime, item.checkInTime);
      if (p.status === "green") greenCount++;
      else if (p.status === "yellow") yellowCount++;
      else if (p.status === "red") redCount++;
    }

    return {
      total: queue.length,
      therapyCount: therapyQueue.length,
      consultationCount: consultationQueue.length,
      greenCount,
      yellowCount,
      redCount,
    };
  }, [queue, therapyQueue.length, consultationQueue.length]);

  // Dynamic login or role-based dashboard button
  const renderUserPortalButton = () => {
    if (!currentUser) {
      return (
        <Link
          href="/login"
          title="Staff Login"
          className="size-7 sm:size-7.5 rounded-lg border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
        >
          <LogIn className="size-3.5" />
        </Link>
      );
    }

    const destination = getRoleDashboard(currentUser.role);

    switch (currentUser.role) {
      case Role.ADMIN:
        return (
          <Link
            href={destination}
            title="Admin Portal"
            className="size-7 sm:size-7.5 rounded-lg border border-purple-500/30 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <Shield className="size-3.5" />
          </Link>
        );
      case Role.DOCTOR:
        return (
          <Link
            href={destination}
            title="Doctor Consultation Desk"
            className="size-7 sm:size-7.5 rounded-lg border border-sky-500/30 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <Stethoscope className="size-3.5" />
          </Link>
        );
      case Role.RECEPTIONIST:
        return (
          <Link
            href={destination}
            title="Receptionist Desk"
            className="size-7 sm:size-7.5 rounded-lg border border-primary/30 bg-primary/15 hover:bg-primary/25 text-primary transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <ClipboardList className="size-3.5" />
          </Link>
        );
      case Role.HANDLER:
        return (
          <Link
            href={destination}
            title="Physical Therapy Desk"
            className="size-7 sm:size-7.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <Activity className="size-3.5" />
          </Link>
        );
      case Role.CASHIER:
        return (
          <Link
            href={destination}
            title="Billing & Cashier Desk"
            className="size-7 sm:size-7.5 rounded-lg border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <CreditCard className="size-3.5" />
          </Link>
        );
      default:
        return (
          <Link
            href={destination}
            title="Staff Portal"
            className="size-7 sm:size-7.5 rounded-lg border border-border/80 bg-card hover:bg-muted text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <LogIn className="size-3.5" />
          </Link>
        );
    }
  };

  return (
    <div className="h-screen max-h-screen w-screen max-w-screen overflow-hidden flex flex-col justify-between bg-gradient-to-br from-background via-muted/20 to-background text-foreground select-none">
      {/* ---------------------------------------------------- */}
      {/* 1. Header (Compact TV Screen Bar)                    */}
      {/* ---------------------------------------------------- */}
      <header className="w-full px-3 sm:px-6 py-2 flex items-center justify-between gap-3 border-b border-border/70 bg-card/75 backdrop-blur-xl shrink-0 shadow-xs z-20">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandLogo size="sm" variant="full" />
        </div>

        {/* Center: Live Digital Clock & Date */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-border/80 bg-background/90 shadow-2xs">
            <Clock className="size-3.5 text-primary shrink-0" />
            <div className="flex items-baseline gap-2 leading-none font-mono">
              <span
                className="text-xs sm:text-sm font-black tracking-tight text-foreground"
                suppressHydrationWarning
              >
                {formattedTime}
              </span>
              <span className="text-border hidden sm:inline">&bull;</span>
              <span
                className="text-[11px] text-muted-foreground hidden sm:inline"
                suppressHydrationWarning
              >
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Right: SSE Health, Language Switcher, Fullscreen, Theme & Login/Dashboard Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* SSE Connection Health */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse"
            }`}
            title={
              connectionStatus === "connected"
                ? "Real-time SSE event stream active"
                : "Connecting to real-time event stream..."
            }
          >
            {connectionStatus === "connected" ? (
              <>
                <Wifi className="size-2.5" />
                <span className="hidden xl:inline">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="size-2.5" />
                <span className="hidden xl:inline">Syncing...</span>
              </>
            )}
          </div>

          <LanguageSwitcher className="h-7 px-1.5 rounded-lg bg-card border-border/80 text-[11px] shadow-xs" />
          <FullscreenToggle className="size-7 rounded-lg border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center shrink-0" />
          <ThemeToggle />
          {renderUserPortalButton()}
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 1.5. Realtime Doctor Calling Large Popup Announcement */}
      {/* ---------------------------------------------------- */}
      {activeAnnouncement && (
        <aside
          role="status"
          aria-live="assertive"
          aria-label="Doctor Calling Announcement"
          className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 select-none overflow-y-auto"
        >
          <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[min(94vh,740px)] p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-4xl border-2 sm:border-4 border-sky-400 bg-background/98 shadow-[0_0_80px_rgba(56,189,248,0.45)] space-y-3 sm:space-y-4 md:space-y-5 text-center relative overflow-hidden ring-4 sm:ring-6 ring-sky-500/25 flex flex-col justify-between my-auto">
            {/* Animated Ambient Radial Glows */}
            <div className="absolute -top-32 -left-32 w-72 h-72 bg-sky-500/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />

            {/* Calling Header Pill */}
            <div className="inline-flex items-center self-center gap-2 sm:gap-3 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-700 dark:text-sky-300 text-xs sm:text-sm md:text-base font-black tracking-widest uppercase shadow-xs animate-pulse">
              <Megaphone className="size-4 sm:size-5 text-sky-600 dark:text-sky-400 animate-bounce" />
              <span>NOW CALLING PATIENT &bull; ডাক্তার ডাকছেন</span>
              <Volume2 className="size-4 sm:size-5 text-sky-600 dark:text-sky-400" />
            </div>

            {/* Patient Name Section */}
            <div className="space-y-1 sm:space-y-2">
              <p className="text-[11px] sm:text-xs md:text-sm uppercase tracking-widest font-mono text-muted-foreground font-bold">
                Please proceed to assigned consultation chamber
              </p>
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight drop-shadow-xs">
                  {activeAnnouncement.patientName}
                </h2>
                {activeAnnouncement.gender && (
                  <span
                    className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wider border shadow-2xs ${
                      activeAnnouncement.gender === "MALE"
                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                        : "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30"
                    }`}
                  >
                    {activeAnnouncement.gender}
                  </span>
                )}
              </div>
            </div>

            {/* Chamber Callout Box */}
            <div className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white border border-sky-300/60 shadow-xl flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-7">
              <div className="p-3 sm:p-4 md:p-5 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner shrink-0">
                <DoorOpen className="size-10 sm:size-14 md:size-16 text-white" />
              </div>
              <div className="text-center sm:text-left space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm md:text-base font-bold uppercase tracking-widest text-sky-100/90">
                  {activeAnnouncement.roomPurpose || "Doctor Consultation"}{" "}
                  &bull; PLEASE PROCEED TO
                </div>
                <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black font-mono tracking-tight text-white drop-shadow-md">
                  ROOM {activeAnnouncement.roomNumber}
                </div>
              </div>
            </div>

            {/* Visual Countdown Progress Bar & Kiosk Auto-Dismiss Status */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="w-full h-2 sm:h-2.5 rounded-full bg-muted/60 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(countdownSeconds / 16) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-mono text-muted-foreground">
                <Volume2 className="size-3.5 sm:size-4 text-sky-500 animate-pulse shrink-0" />
                <span>
                  Chime & Voice Broadcast &bull; Clearing automatically in{" "}
                  <strong className="text-foreground font-black">
                    {countdownSeconds}s
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. Main Live Queue: High-Density 2-Column Grid       */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-2 sm:p-3 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        {/* Column 1: Therapy Queue */}
        <section className="flex flex-col min-h-0 h-full rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xs">
          {/* Compact Column Header */}
          <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/20 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Activity className="size-4" />
              </div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                Therapy Queue
              </h2>
              <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {therapyQueue.length}
              </span>
            </div>

            <span className="text-[10.5px] font-semibold text-muted-foreground">
              Therapy Rooms
            </span>
          </div>

          {/* Column Scrollable Content: Dense Multi-Column Sub-Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5">
            {therapyQueue.length === 0 ? (
              <EmptyQueueCard title="Therapy Queue is Clear" />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 auto-rows-max">
                {therapyQueue.map((item) => (
                  <QueueItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Column 2: Consultation Queue */}
        <section className="flex flex-col min-h-0 h-full rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xs">
          {/* Compact Column Header */}
          <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/20 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                <Stethoscope className="size-4" />
              </div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                Consultation Queue
              </h2>
              <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                {consultationQueue.length}
              </span>
            </div>

            <span className="text-[10.5px] font-semibold text-muted-foreground">
              Doctor Chambers
            </span>
          </div>

          {/* Column Scrollable Content: Dense Multi-Column Sub-Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5">
            {consultationQueue.length === 0 ? (
              <EmptyQueueCard title="Consultation Queue is Clear" />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 auto-rows-max">
                {consultationQueue.map((item) => (
                  <QueueItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------- */}
      {/* 3. Screen Footer Ticker (Live Summary Counts)        */}
      {/* ---------------------------------------------------- */}
      <footer className="w-full px-3 sm:px-6 py-1.5 border-t border-border/70 bg-card/75 backdrop-blur-xl shrink-0 shadow-xs z-20 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs">
        {/* Left: Queue Counters & Punctuality Breakdown */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1 font-semibold text-foreground text-[11.5px]">
            <Users className="size-3 text-primary" />
            <span>Total Waiting:</span>
            <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold font-mono text-[11px]">
              {stats.total}
            </span>
          </div>

          <div className="h-3 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Therapy: {stats.therapyCount}</span>
            </span>

            <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
              <span className="size-1.5 rounded-full bg-sky-500" />
              <span>Consultation: {stats.consultationCount}</span>
            </span>
          </div>

          <div className="h-3 w-px bg-border hidden md:block" />

          {/* Punctuality counters */}
          <div className="hidden md:flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>On Time: {stats.greenCount}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>Moderate: {stats.yellowCount}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-500" />
              <span>Late: {stats.redCount}</span>
            </span>
          </div>
        </div>

        {/* Right: Hospital Notice */}
        <div className="text-[10.5px] text-muted-foreground flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-primary" />
          <span>
            Health And Pain Care Center &bull; Realtime Waiting Hall Display
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Ultra-compact, high-density patient queue card designed for TV display visibility.
 * Displays Patient Name, Gender tag, Late Time (Punctuality Badge), Told Time, and In Time.
 * Fits 25-30+ items per queue section on a standard 1080p wall display.
 */
function QueueItemCard({ item }: { item: AppointmentWithRelations }) {
  const p = evaluatePunctuality(item.toldTime, item.checkInTime);
  const isMale = item.gender === "MALE";
  const roomNumber = item.room?.number || item.therapySlot?.room?.number;
  const isCalling = item.status === "CALLING";
  const isServing =
    item.status === "IN_THERAPY" || item.status === "IN_CONSULTATION";

  return (
    <div
      className={`rounded-xl border px-3 py-1.5 sm:py-2 flex flex-col justify-between gap-1 shadow-2xs transition-all duration-150 ${
        isCalling
          ? "bg-amber-500/15 dark:bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/35 shadow-sm"
          : `${p.cardClass} ${p.borderClass}`
      }`}
    >
      {/* Top Row: Patient Name & Late Time (Punctuality Badge) */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-black text-foreground tracking-tight truncate">
            {item.patient?.name || "Patient"}
          </h3>

          <span
            className={`px-1 py-0.2 rounded text-[9px] font-bold shrink-0 border ${
              isMale
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
            }`}
          >
            {isMale ? "M" : "F"}
          </span>

          {item.bookingType === "EXTRA" && (
            <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold shrink-0">
              Extra
            </span>
          )}

          {roomNumber && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold shrink-0 border ${
                isCalling
                  ? "bg-amber-500/25 text-amber-800 dark:text-amber-200 border-amber-500/50 animate-pulse font-bold"
                  : isServing
                    ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40 animate-pulse"
                    : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <DoorOpen className="size-2.5" />
              <span>Room {roomNumber}</span>
            </span>
          )}
        </div>

        {/* Late time / punctuality status badge */}
        {isCalling ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black border shrink-0 bg-amber-500 text-white border-amber-600 animate-pulse shadow-xs">
            <Radio className="size-2.5 shrink-0" />
            <span>ডাকছেন • CALLING</span>
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${p.badgeClass}`}
          >
            {p.status === "green" ? (
              <CheckCircle2 className="size-2.5 shrink-0" />
            ) : p.status === "yellow" ? (
              <AlertCircle className="size-2.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-2.5 shrink-0" />
            )}
            <span>{p.label}</span>
          </span>
        )}
      </div>

      {/* Middle Row: Prominent "Will Call Time" or Calling Banner */}
      {isCalling ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-950 dark:text-amber-100 shadow-xs animate-pulse ring-1 ring-amber-500/30">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-200">
            <Radio className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="tracking-wide text-[10.5px] uppercase font-black">
              Please Enter Chamber:
            </span>
          </div>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-amber-900 dark:text-amber-100 bg-amber-500/30 px-2 py-0.5 rounded border border-amber-500/40">
            {roomNumber ? `Room ${roomNumber}` : "Chamber"}
          </span>
        </div>
      ) : isServing ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-950 dark:text-emerald-100 shadow-2xs animate-pulse">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <DoorOpen className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="tracking-wide text-[10.5px] uppercase font-bold">
              Now In Session:
            </span>
          </div>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-emerald-800 dark:text-emerald-200 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
            {roomNumber ? `Room ${roomNumber}` : "In Session"}
          </span>
        </div>
      ) : item.willCallTime ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-sky-500/15 dark:bg-sky-950/50 border border-sky-500/35 text-sky-950 dark:text-sky-100 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
            <Clock className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0 animate-pulse" />
            <span className="tracking-wide text-[10.5px] font-bold">
              Will Call:
            </span>
          </div>
          <div className="flex items-center gap-1 bg-sky-500/20 dark:bg-sky-900/70 px-2 py-0.5 rounded border border-sky-500/30">
            <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-sky-900 dark:text-sky-100">
              {item.willCallTime}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-2.5 py-0.5 rounded bg-muted/25 border border-border/40 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1 text-[9.5px]">
            <Clock className="size-2.5 opacity-60 text-muted-foreground" />
            <span>Will Call:</span>
          </div>
          <span className="text-[10px] text-muted-foreground/80 font-sans italic">
            Estimating...
          </span>
        </div>
      )}

      {/* Bottom Row: Told Time & In Time */}
      <div className="flex items-center justify-between text-[10px] sm:text-[10.5px] font-mono pt-1 border-t border-border/40 leading-none">
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-[9px] uppercase font-semibold text-muted-foreground/75">
            Told:
          </span>
          <span className="font-bold text-foreground">
            {item.toldTime || "--:--"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase font-semibold text-muted-foreground/75">
            In:
          </span>
          <span className={`font-bold ${p.textClass}`} suppressHydrationWarning>
            {formatTime12h(item.checkInTime)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Clean, compact empty state for a clear queue
 */
function EmptyQueueCard({ title }: { title: string }) {
  return (
    <div className="h-full min-h-[140px] rounded-xl border border-dashed border-border/50 bg-muted/5 flex flex-col items-center justify-center p-4 text-center space-y-1.5 text-muted-foreground">
      <Users className="size-5 text-muted-foreground/50" />
      <span className="text-xs font-semibold text-foreground/80">{title}</span>
      <span className="text-[10px] font-mono text-muted-foreground/60">
        Listening for real-time check-ins...
      </span>
    </div>
  );
}
