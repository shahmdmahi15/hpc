"use client";

import { useEffect, useState, useCallback, useTransition, useRef } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { playClinicChime } from "@/lib/chime";
import { formatBSTTime, formatBSTDate } from "@/lib/date";
import { getKioskWaitingRoomData } from "@/actions/kiosk";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Radio,
  PhoneCall,
  Clock,
  MapPin,
  Users,
} from "lucide-react";

interface WaitingRoomDisplayProps {
  initialData: Awaited<ReturnType<typeof getKioskWaitingRoomData>>;
}

export function WaitingRoomDisplay({ initialData }: WaitingRoomDisplayProps) {
  const [data, setData] = useState(initialData);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [calledAlert, setCalledAlert] = useState<{
    serialNumber: number;
    patientName: string;
    patientId: string;
    roomNo: string;
    doctorName?: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  const queueContainerRef = useRef<HTMLDivElement | null>(null);
  const servingContainerRef = useRef<HTMLDivElement | null>(null);

  // Live Digital Clock in Bangladesh Standard Time (BST)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(formatBSTTime(now, true));
      setCurrentDate(formatBSTDate(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = await getKioskWaitingRoomData();
        setData(updated);

        // Smooth scroll queue to top on new update
        if (queueContainerRef.current) {
          queueContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        console.error("Failed to refresh kiosk data", err);
      }
    });
  }, []);

  // Auto-scroll loop for waiting queue on TV display when content exceeds viewport
  useEffect(() => {
    const container = queueContainerRef.current;
    if (!container) return;

    let scrollDirection = 1;
    const scrollInterval = setInterval(() => {
      if (!container) return;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;

      if (container.scrollTop >= maxScroll - 5) {
        scrollDirection = -1;
      } else if (container.scrollTop <= 5) {
        scrollDirection = 1;
      }

      container.scrollBy({ top: scrollDirection * 1.5, behavior: "smooth" });
    }, 100);

    return () => clearInterval(scrollInterval);
  }, [data.waitingSerials]);

  // SSE Realtime Hook
  useRealtime({
    onEvent: (event) => {
      if (event.type === "SERIAL_CALLED" && event.data) {
        setCalledAlert({
          serialNumber: event.data.serialNumber,
          patientName: event.data.patientName,
          patientId: event.data.patientId,
          roomNo: event.data.roomNo || "205",
          doctorName: event.data.doctorName,
        });

        if (soundEnabled) {
          playClinicChime("call");
        }

        setTimeout(() => {
          setCalledAlert(null);
        }, 14000);
      }
      refreshData();
    },
    onRefresh: refreshData,
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-16 flex items-center justify-between px-5 sm:px-8 bg-card border-b border-border shadow-xs shrink-0 z-30">
        <div className="flex items-center gap-4">
          <BrandLogo size="md" variant="full" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider">
            <Radio className="h-3.5 w-3.5 animate-pulse text-primary" />
            <span>LIVE WAITING ROOM KIOSK (BST)</span>
          </div>
        </div>

        {/* BST Clock & TV Controls */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-black font-mono text-primary tracking-wider leading-none">
              {currentTime}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {currentDate} (BST)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={
                soundEnabled
                  ? "Mute Announcement Chime"
                  : "Enable Announcement Chime"
              }
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen TV Mode"
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Broadcast Flash Calling Overlay */}
      {calledAlert && (
        <div className="fixed inset-x-4 top-20 z-50 animate-bounce">
          <div className="max-w-4xl mx-auto p-6 rounded-3xl bg-primary text-primary-foreground shadow-2xl border-4 border-background flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-background text-foreground font-black text-4xl shadow-xl font-mono">
                #{calledAlert.serialNumber}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-primary-foreground/90 font-extrabold flex items-center gap-1.5">
                  <PhoneCall className="h-4 w-4 animate-ping" />
                  <span>NOW CALLING / এখন ডাকা হচ্ছে</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-0.5">
                  {calledAlert.patientName}
                </h2>
                <p className="text-sm sm:text-base text-primary-foreground/90 font-semibold mt-0.5">
                  ID: #{calledAlert.patientId} &bull; Please enter:{" "}
                  <span className="font-black underline uppercase text-background bg-foreground px-2 py-0.5 rounded">
                    {calledAlert.roomNo}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right hidden sm:block font-mono text-3xl font-black opacity-90">
              Room {calledAlert.roomNo}
            </div>
          </div>
        </div>
      )}

      {/* Main Fullscreen Board (2 Equal Balanced Columns with Zero Outer Clipping) */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 overflow-hidden max-w-[1920px] w-full mx-auto">
        {/* LEFT COLUMN: NOW SERVING (Active In Chamber or Therapy) */}
        <Card className="h-full border-2 border-primary bg-card shadow-lg rounded-2xl p-4 sm:p-5 flex flex-col min-h-0 overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-primary animate-ping" />
              <h2 className="font-extrabold text-base tracking-wide text-foreground uppercase">
                এখন চলছে / NOW SERVING
              </h2>
            </div>
            <Badge variant="default" className="font-bold text-xs">
              {data.currentlyCalling.length} IN SESSION
            </Badge>
          </div>

          {/* Card Body with Independent Scroll Stream */}
          <div
            ref={servingContainerRef}
            className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 space-y-3"
          >
            {data.currentlyCalling.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground font-medium text-sm text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <span>
                  Chambers ready. Next patient will be called shortly.
                </span>
              </div>
            ) : (
              data.currentlyCalling.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-primary text-primary-foreground font-black text-3xl font-mono shadow-md shrink-0">
                      #{s.serialNumber}
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-foreground">
                        {s.patient.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-bold text-primary mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="uppercase">
                          Room {s.roomNo || "205"}
                        </span>
                        <span>&bull;</span>
                        <span className="font-mono">
                          ID: #{s.patient.patientId}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="default"
                    className="text-xs font-extrabold uppercase px-3 py-1 shrink-0"
                  >
                    {s.status.replace("_", " ")}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* RIGHT COLUMN: WAITING QUEUE (Live Queue with Dynamic Priority) */}
        <Card className="h-full border border-border bg-card shadow-lg rounded-2xl p-4 sm:p-5 flex flex-col min-h-0 overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-extrabold text-base tracking-wide text-foreground uppercase">
                অপেক্ষারত সিরিয়াল তালিকা / WAITING QUEUE
              </h2>
            </div>
            <Badge variant="outline" className="font-mono text-xs font-bold">
              {data.waitingSerials.length} Patients Waiting
            </Badge>
          </div>

          {/* Card Body with Smooth Continuous Auto-Scroll */}
          <div
            ref={queueContainerRef}
            className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 space-y-2.5 scroll-smooth"
          >
            {data.waitingSerials.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm font-medium text-center py-12">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <span>Currently no patients waiting in lounge.</span>
              </div>
            ) : (
              data.waitingSerials.map((s, idx) => (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    idx === 0
                      ? "bg-primary/10 border-primary shadow-xs font-bold"
                      : "bg-muted/30 border-border hover:bg-muted/50"
                  }`}
                >
                  {/* Big Monospace Token & Patient Details */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex items-center justify-center h-12 w-12 rounded-xl font-black text-2xl font-mono shadow-xs shrink-0 ${
                        idx === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-foreground"
                      }`}
                    >
                      #{s.serialNumber}
                    </div>
                    <div>
                      <div className="font-extrabold text-base text-foreground flex items-center gap-2">
                        <span>{s.patient.name}</span>
                        {s.isReport && (
                          <Badge variant="secondary" className="text-[10px]">
                            রিপোর্ট
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        ID: #{s.patient.patientId} &bull;{" "}
                        {s.toldTime
                          ? formatBSTTime(s.toldTime)
                          : s.timeSlot || "Scheduled"}
                      </div>
                    </div>
                  </div>

                  {/* Arrival Punctuality Status & Rank Badge */}
                  <div className="flex items-center gap-3 shrink-0">
                    {s.inTime ? (
                      <div className="text-right">
                        {s.punctualityStatus === "ON_TIME" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            সময়মত
                          </span>
                        )}
                        {s.punctualityStatus === "MODERATE_LATE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            +{s.latenessMinutes}m
                          </span>
                        )}
                        {s.punctualityStatus === "SEVERE_LATE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-destructive/15 text-destructive border border-destructive/30">
                            +{s.latenessMinutes}m (-5 Pos)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        En route
                      </span>
                    )}

                    <Badge
                      variant={idx === 0 ? "default" : "outline"}
                      className="text-xs font-mono font-bold px-2.5 py-0.5"
                    >
                      {idx === 0 ? "Next" : `#${idx + 1}`}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </main>

      {/* Bottom Footer Strip */}
      <footer className="h-10 px-6 sm:px-8 bg-card border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0 z-30">
        <div className="font-semibold text-foreground flex items-center gap-2">
          <span>Health And Pain Care Center</span>
          <span>&bull;</span>
          <span className="text-primary font-mono font-bold">1515615188</span>
        </div>
        <div className="text-[11px] text-muted-foreground font-medium hidden sm:block">
          Bangladesh Standard Time &bull; Live Real-Time Queue
        </div>
      </footer>
    </div>
  );
}
