"use client";

import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { LanguageSwitcher, useI18n, formatNumberByLang, formatDateByLang } from "@/lib/i18n";
import { useLiveClock } from "@/hooks/use-live-clock";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import {
  getLiveQueueAction,
  type AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import { evaluatePunctuality, formatTime12h, getLocalizedPunctualityLabel } from "@/lib/queue-punctuality";
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
  VolumeX,
  Megaphone,
  Bell,
  LogIn,
  ClipboardList,
  CreditCard,
  Shield,
  Radio,
  Tv,
} from "lucide-react";

interface DoctorCallAnnouncement {
  appointmentId: string;
  serialNumber?: number;
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
  initialQueue = [],
  initialDate,
  currentUser,
}: WaitingRoomLiveQueueViewProps) {
  const { lang, t } = useI18n();
  const [queue, setQueue] =
    React.useState<AppointmentWithRelations[]>(Array.isArray(initialQueue) ? initialQueue : []);
  const [activeAnnouncement, setActiveAnnouncement] =
    React.useState<DoctorCallAnnouncement | null>(null);
  const [countdownSeconds, setCountdownSeconds] = React.useState<number>(16);

  // 100% Offline Audio & Speech Announcement controls (Enabled & Unlocked by default for kiosk/TV)
  const [isAudioEnabled, setIsAudioEnabled] = React.useState<boolean>(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = React.useState<boolean>(true);
  const [speechLanguageMode, setSpeechLanguageMode] = React.useState<
    "bilingual" | "en" | "bn"
  >("bilingual");
  const [departmentFilter, setDepartmentFilter] = React.useState<
    "ALL" | "CONSULTATION" | "THERAPY"
  >("ALL");

  // Screen Wake Lock API state (Prevents TV/Kiosk sleep mode)
  const [isWakeLockActive, setIsWakeLockActive] = React.useState<boolean>(false);
  const wakeLockRef = React.useRef<any>(null);

  // TV Leanback & D-Pad Navigation state
  const [activeColumnIndex, setActiveColumnIndex] = React.useState<0 | 1>(0);
  const therapyListRef = React.useRef<HTMLDivElement | null>(null);
  const consultationListRef = React.useRef<HTMLDivElement | null>(null);
  const lastInteractionTimeRef = React.useRef<number>(Date.now());

  // Read URL search params (e.g. ?dept=doctor or ?dept=therapy)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dept = params.get("dept")?.toLowerCase();
      if (dept === "doctor" || dept === "consultation") {
        setDepartmentFilter("CONSULTATION");
      } else if (dept === "therapy") {
        setDepartmentFilter("THERAPY");
      }
    }
  }, []);

  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const activeUtterancesRef = React.useRef<SpeechSynthesisUtterance[]>([]);
  const cachedVoicesRef = React.useRef<SpeechSynthesisVoice[]>([]);
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

  // Auto-activate audio context on mount for unattended TV/kiosk/app display
  React.useEffect(() => {
    const autoUnlock = () => {
      try {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.resume();
        }
        setIsAudioUnlocked(true);
      } catch {}
    };

    autoUnlock();

    // Silently unlock on first natural interaction without prompting user
    const events = ["pointerdown", "touchstart", "keydown", "click"];
    const handleFirstInteraction = () => {
      autoUnlock();
      events.forEach((e) =>
        window.removeEventListener(e, handleFirstInteraction),
      );
    };

    events.forEach((e) =>
      window.addEventListener(e, handleFirstInteraction, {
        once: true,
        passive: true,
      }),
    );

    return () => {
      events.forEach((e) =>
        window.removeEventListener(e, handleFirstInteraction),
      );
    };
  }, [getAudioContext]);

  // Screen Wake Lock API implementation: guarantees TV display stays powered on
  React.useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (typeof window === "undefined" || !("wakeLock" in navigator)) {
        return;
      }
      try {
        if (wakeLockRef.current && !wakeLockRef.current.released) {
          return;
        }
        const lock = await (navigator as any).wakeLock.request("screen");
        if (!isMounted) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
        setIsWakeLockActive(true);

        lock.addEventListener("release", () => {
          if (isMounted) {
            setIsWakeLockActive(false);
          }
        });
      } catch (err) {
        console.warn("[Screen Wake Lock Request]:", err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Play rich resonant dual hospital bell chime (Ding-Dong) using native Web Audio API (100% offline)
  const playDoctorCallChime = React.useCallback(() => {
    try {
      const nativeBridge =
        (window as any).HpcNative || (window as any).AndroidTTS;
      if (nativeBridge && typeof nativeBridge.playChime === "function") {
        nativeBridge.playChime();
        return;
      }

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

  // Synchronize audio preferences from localStorage
  React.useEffect(() => {
    try {
      const savedAudio = localStorage.getItem("hpc_kiosk_audio");
      if (savedAudio !== null) setIsAudioEnabled(savedAudio === "true");
      const savedMode = localStorage.getItem("hpc_kiosk_speech_mode");
      if (savedMode === "en" || savedMode === "bn" || savedMode === "bilingual") {
        setSpeechLanguageMode(savedMode);
      }
    } catch {}
  }, []);

  // Preload and cache browser offline speech voices safely across Web, Android WebView & TV
  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !window.speechSynthesis) return;

    const loadVoices = () => {
      try {
        if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.getVoices === "function") {
          cachedVoicesRef.current = window.speechSynthesis.getVoices() || [];
        }
      } catch {}
    };

    loadVoices();

    const synth = window.speechSynthesis;
    try {
      if (typeof synth?.addEventListener === "function") {
        synth.addEventListener("voiceschanged", loadVoices);
      } else if (synth && "onvoiceschanged" in synth) {
        synth.onvoiceschanged = loadVoices;
      }
    } catch {}

    return () => {
      try {
        const currentSynth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
        if (currentSynth) {
          if (typeof currentSynth.removeEventListener === "function") {
            currentSynth.removeEventListener("voiceschanged", loadVoices);
          } else if ("onvoiceschanged" in currentSynth) {
            currentSynth.onvoiceschanged = null;
          }
        }
      } catch {}
    };
  }, []);

  // Unlocks browser audio context after user interaction (handles autoplay policy)
  const unlockAudio = React.useCallback(() => {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      setIsAudioUnlocked(true);
    }
  }, [getAudioContext]);

  // Broadcast both audible chime and clear speech synthesis voice announcement (100% offline)
  const playAnnouncementSound = React.useCallback(
    (announcement: DoctorCallAnnouncement) => {
      if (!isAudioEnabled) return;

      const tokenStr = announcement.serialNumber
        ? `Token ${announcement.serialNumber}, `
        : "";
      const tokenStrBn = announcement.serialNumber
        ? `টোকেন ${announcement.serialNumber}, `
        : "";

      const enText = `Attention please. ${tokenStr}Patient ${announcement.patientName}. Please proceed to Room ${announcement.roomNumber}.`;
      const bnText = `দয়া করে মনোযোগ দিন। ${tokenStrBn}রোগী ${announcement.patientName}, রুম নম্বর ${announcement.roomNumber}-এ আসুন।`;

      // Priority 1: Check for Native Android / Tauri 100% Offline TTS Bridge
      if (typeof window !== "undefined") {
        const nativeBridge =
          (window as any).HpcNative || (window as any).AndroidTTS;
        if (nativeBridge) {
          try {
            if (typeof nativeBridge.speakDoctorCall === "function") {
              const tokenArg =
                announcement.serialNumber != null
                  ? String(announcement.serialNumber)
                  : "";
              const roomArg = announcement.roomNumber
                ? String(announcement.roomNumber)
                : "";
              const patientArg = announcement.patientName || "";
              const handled = nativeBridge.speakDoctorCall(
                tokenArg,
                patientArg,
                roomArg,
                speechLanguageMode,
                enText,
                bnText,
              );
              if (handled !== false) {
                return;
              }
            } else if (
              typeof nativeBridge.speakAnnouncement === "function"
            ) {
              const handled = nativeBridge.speakAnnouncement(
                enText,
                bnText,
                speechLanguageMode,
              );
              if (handled !== false) {
                return;
              }
            }
          } catch (bridgeErr) {
            console.warn(
              "[HPC Native TTS Bridge Error, falling back to Web Speech]:",
              bridgeErr,
            );
          }
        }
      }

      // Priority 2: Standard Browser / Web Speech API (100% offline)
      // 1. Trigger resonant airport/hospital chime (Web Audio API)
      playDoctorCallChime();

      // 2. Trigger clear spoken text-to-speech announcement (offline native browser API)
      if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis) {
        try {
          if (typeof window.speechSynthesis.cancel === "function") {
            window.speechSynthesis.cancel();
          }
          if (typeof window.speechSynthesis.resume === "function") {
            window.speechSynthesis.resume();
          }

          setTimeout(() => {
            try {
              if (!window.speechSynthesis) return;
              const voices =
                cachedVoicesRef.current.length > 0
                  ? cachedVoicesRef.current
                  : typeof window.speechSynthesis.getVoices === "function"
                    ? window.speechSynthesis.getVoices()
                    : [];

              const bnVoice = voices.find(
                (v) =>
                  v.lang?.toLowerCase().startsWith("bn") ||
                  v.name?.toLowerCase().includes("bangla") ||
                  v.name?.toLowerCase().includes("bengali"),
              );

              const enUtterance = new SpeechSynthesisUtterance(enText);
              enUtterance.rate = 0.9;
              enUtterance.pitch = 1.0;
              enUtterance.volume = 1.0;

              activeUtterancesRef.current.push(enUtterance);
              enUtterance.onend = () => {
                activeUtterancesRef.current =
                  activeUtterancesRef.current.filter((u) => u !== enUtterance);
              };
              enUtterance.onerror = () => {
                activeUtterancesRef.current =
                  activeUtterancesRef.current.filter((u) => u !== enUtterance);
              };

              const speakBangla = () => {
                if (bnVoice || speechLanguageMode === "bn") {
                  const bnUtterance = new SpeechSynthesisUtterance(bnText);
                  if (bnVoice) bnUtterance.voice = bnVoice;
                  bnUtterance.lang = "bn-BD";
                  bnUtterance.rate = 0.88;
                  bnUtterance.volume = 1.0;

                  activeUtterancesRef.current.push(bnUtterance);
                  bnUtterance.onend = () => {
                    activeUtterancesRef.current =
                      activeUtterancesRef.current.filter(
                        (u) => u !== bnUtterance,
                      );
                  };
                  bnUtterance.onerror = () => {
                    activeUtterancesRef.current =
                      activeUtterancesRef.current.filter(
                        (u) => u !== bnUtterance,
                      );
                  };

                  if (typeof window.speechSynthesis?.speak === "function") {
                    window.speechSynthesis.speak(bnUtterance);
                  }
                }
              };

              if (speechLanguageMode === "bn") {
                speakBangla();
              } else if (speechLanguageMode === "bilingual") {
                enUtterance.onend = () => {
                  activeUtterancesRef.current =
                    activeUtterancesRef.current.filter((u) => u !== enUtterance);
                  setTimeout(speakBangla, 350);
                };
                if (typeof window.speechSynthesis?.speak === "function") {
                  window.speechSynthesis.speak(enUtterance);
                }
              } else {
                if (typeof window.speechSynthesis?.speak === "function") {
                  window.speechSynthesis.speak(enUtterance);
                }
              }
            } catch (e) {
              console.warn("[Speech Synthesis Error]:", e);
            }
          }, 1100);
        } catch (err) {
          console.warn("[Speech Synthesis Cancel Error]:", err);
        }
      }
    },
    [isAudioEnabled, speechLanguageMode, playDoctorCallChime],
  );

  const testAnnouncementSound = React.useCallback(() => {
    unlockAudio();
    playAnnouncementSound({
      appointmentId: "test-call",
      serialNumber: 1,
      patientName: "Patient Name",
      gender: "FEMALE",
      roomNumber: "1",
      roomPurpose: "Doctor Consultation",
      timestamp: new Date().toISOString(),
    });
  }, [unlockAudio, playAnnouncementSound]);

  const toggleAudio = React.useCallback(() => {
    setIsAudioEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("hpc_kiosk_audio", String(next));
      } catch {}
      if (next) {
        unlockAudio();
      }
      return next;
    });
  }, [unlockAudio]);

  const refreshQueue = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getLiveQueueAction();
        if (res && res.success && Array.isArray(res.queue)) {
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
        const rawData = event.data as DoctorCallAnnouncement;
        const announcementData: DoctorCallAnnouncement = { ...rawData };
        if (announcementData.serialNumber === undefined) {
          const idx = queue.findIndex(
            (item) => item.id === announcementData.appointmentId,
          );
          if (idx !== -1) {
            announcementData.serialNumber = idx + 1;
          }
        }
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
          if (
            (d.status === "IN_CONSULTATION" ||
              d.status === "IN_THERAPY" ||
              d.status === "COMPLETED" ||
              d.status === "CANCELLED") &&
            activeAnnouncement?.appointmentId === d.id
          ) {
            setActiveAnnouncement(null);
          }
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

  // D-Pad and Keyboard Remote Navigation (TV Leanback Mode)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      lastInteractionTimeRef.current = Date.now();

      // Dismiss announcement if open
      if (activeAnnouncement) {
        if (
          e.key === "Enter" ||
          e.key === " " ||
          e.key === "Escape" ||
          e.key === "Backspace"
        ) {
          e.preventDefault();
          setActiveAnnouncement(null);
          return;
        }
      }

      const activeContainer =
        departmentFilter === "CONSULTATION"
          ? consultationListRef.current
          : departmentFilter === "THERAPY"
            ? therapyListRef.current
            : activeColumnIndex === 0
              ? therapyListRef.current
              : consultationListRef.current;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (activeContainer) {
            activeContainer.scrollBy({ top: 180, behavior: "smooth" });
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (activeContainer) {
            activeContainer.scrollBy({ top: -180, behavior: "smooth" });
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (departmentFilter === "ALL") {
            setActiveColumnIndex(0);
          } else if (departmentFilter === "CONSULTATION") {
            setDepartmentFilter("ALL");
          } else if (departmentFilter === "THERAPY") {
            setDepartmentFilter("CONSULTATION");
          }
          break;

        case "ArrowRight":
          e.preventDefault();
          if (departmentFilter === "ALL") {
            setActiveColumnIndex(1);
          } else if (departmentFilter === "CONSULTATION") {
            setDepartmentFilter("THERAPY");
          }
          break;

        case "Enter":
        case " ":
          if (
            document.activeElement?.tagName !== "BUTTON" &&
            document.activeElement?.tagName !== "A"
          ) {
            e.preventDefault();
            unlockAudio();
            testAnnouncementSound();
          }
          break;

        case "f":
        case "F":
          if (
            document.activeElement?.tagName !== "INPUT" &&
            document.activeElement?.tagName !== "TEXTAREA"
          ) {
            e.preventDefault();
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
              document.exitFullscreen?.().catch(() => {});
            }
          }
          break;

        case "m":
        case "M":
          if (
            document.activeElement?.tagName !== "INPUT" &&
            document.activeElement?.tagName !== "TEXTAREA"
          ) {
            e.preventDefault();
            toggleAudio();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeAnnouncement,
    departmentFilter,
    activeColumnIndex,
    unlockAudio,
    testAnnouncementSound,
    toggleAudio,
  ]);

  // Gentle Auto-Scroll for unattended wall TV displays (scrolls if content overflows and TV is idle)
  React.useEffect(() => {
    const autoScrollInterval = setInterval(() => {
      if (Date.now() - lastInteractionTimeRef.current < 15000) return;
      if (activeAnnouncement) return;

      const containers = [
        therapyListRef.current,
        consultationListRef.current,
      ].filter(Boolean) as HTMLDivElement[];

      containers.forEach((container) => {
        if (!container) return;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 20) return;

        if (
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - 10
        ) {
          container.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          container.scrollBy({ top: 120, behavior: "smooth" });
        }
      });
    }, 6000);

    return () => clearInterval(autoScrollInterval);
  }, [activeAnnouncement]);

  // Formatted digital clock strings
  const formattedTime = currentTime
    ? (lang === "bn"
        ? formatNumberByLang(
            currentTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            }),
            "bn"
          )
        : currentTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }))
    : "--:--:--";

  const formattedDate = currentTime
    ? formatDateByLang(currentTime, lang)
    : initialDate;

  // Split queue into 2 distinct columns: Therapy Queue & Consultation Queue
  const therapyQueue = React.useMemo(() => {
    return (queue || []).filter((item) => (item?.queueType || "THERAPY") === "THERAPY");
  }, [queue]);

  const consultationQueue = React.useMemo(() => {
    return (queue || []).filter((item) => item?.queueType === "CONSULTATION");
  }, [queue]);

  // Queue Punctuality Statistics
  const stats = React.useMemo(() => {
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    const safeQueue = Array.isArray(queue) ? queue : [];
    for (const item of safeQueue) {
      if (!item) continue;
      const p = evaluatePunctuality(item.toldTime, item.checkInTime);
      if (p.status === "green") greenCount++;
      else if (p.status === "yellow") yellowCount++;
      else if (p.status === "red") redCount++;
    }

    return {
      total: safeQueue.length,
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
    <div className="min-h-screen md:h-dvh md:max-h-dvh w-full overflow-y-auto md:overflow-hidden flex flex-col justify-between bg-gradient-to-br from-background via-muted/20 to-background text-foreground select-none">
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
          {/* Department View Switcher */}
          <div className="flex items-center bg-card border border-border/80 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setDepartmentFilter("ALL")}
              className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                departmentFilter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "bn" ? "সকল" : "All"}
            </button>
            <button
              type="button"
              onClick={() => setDepartmentFilter("CONSULTATION")}
              className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                departmentFilter === "CONSULTATION"
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "bn" ? "চেম্বার" : "Chambers"}
            </button>
            <button
              type="button"
              onClick={() => setDepartmentFilter("THERAPY")}
              className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                departmentFilter === "THERAPY"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "bn" ? "থেরাপি" : "Therapy"}
            </button>
          </div>

          {/* Screen Wake Lock Status Badge */}
          <div
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
              isWakeLockActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border/80"
            }`}
            title={
              isWakeLockActive
                ? lang === "bn"
                  ? "স্ক্রিন ওয়েক লক সক্রিয় (টিভি ডিসপ্লে স্লিপ মোডে যাবে না)"
                  : "Screen Wake Lock Active (TV display will stay awake)"
                : lang === "bn"
                  ? "স্ক্রিন ওয়েক লক নিষ্ক্রিয়"
                  : "Screen Wake Lock Inactive"
            }
          >
            <Tv className="size-2.5" />
            <span className="hidden xl:inline">
              {isWakeLockActive
                ? lang === "bn"
                  ? "সজাগ"
                  : "Awake"
                : lang === "bn"
                  ? "টিভি"
                  : "TV"}
            </span>
          </div>

          {/* SSE Connection Health */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse"
            }`}
            title={
              connectionStatus === "connected"
                ? lang === "bn"
                  ? "রিয়েল-টাইম লাইভ ইভেন্ট সক্রিয়"
                  : "Real-time SSE event stream active"
                : lang === "bn"
                  ? "রিয়েল-টাইম ইভেন্টে সংযুক্ত হচ্ছে..."
                  : "Connecting to real-time event stream..."
            }
          >
            {connectionStatus === "connected" ? (
              <>
                <Wifi className="size-2.5" />
                <span className="hidden xl:inline">
                  {lang === "bn" ? "লাইভ" : "Live"}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="size-2.5" />
                <span className="hidden xl:inline">
                  {lang === "bn" ? "সিঙ্ক হচ্ছে..." : "Syncing..."}
                </span>
              </>
            )}
          </div>

          {/* Offline Audio / Speech Controls */}
          <div className="flex items-center gap-1 bg-card border border-border/80 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={toggleAudio}
              title={
                isAudioEnabled
                  ? lang === "bn"
                    ? "ভয়েস ঘোষণা চালু (মিউট করতে ক্লিক করুন)"
                    : "Voice announcements active (Click to mute)"
                  : lang === "bn"
                    ? "ভয়েস ঘোষণা বন্ধ (চালু করতে ক্লিক করুন)"
                    : "Voice announcements muted (Click to enable)"
              }
              className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                isAudioEnabled
                  ? "text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {isAudioEnabled ? (
                <Volume2 className="size-3.5" />
              ) : (
                <VolumeX className="size-3.5" />
              )}
            </button>

            {/* Test Audio Button */}
            <button
              type="button"
              onClick={testAnnouncementSound}
              title={
                lang === "bn"
                  ? "সাউন্ড টেস্ট: অফলাইন হসপিটাল বেল ও ভয়েস ঘোষণা শুনুন"
                  : "Test Sound: Play offline hospital chime & speech announcement"
              }
              className="h-7 px-2 text-[10px] font-bold rounded-md border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Bell className="size-2.5 animate-pulse" />
              <span className="hidden lg:inline">
                {lang === "bn" ? "সাউন্ড টেস্ট" : "Test Sound"}
              </span>
            </button>
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
              <span>
                {lang === "bn"
                  ? "রোগীকে ডাকা হচ্ছে • NOW CALLING"
                  : "NOW CALLING PATIENT • ডাক্তার ডাকছেন"}
              </span>
              <Volume2 className="size-4 sm:size-5 text-sky-600 dark:text-sky-400" />
            </div>

            {/* Patient Name Section */}
            <div className="space-y-1 sm:space-y-2">
              <p className="text-[11px] sm:text-xs md:text-sm uppercase tracking-widest font-mono text-muted-foreground font-bold">
                {lang === "bn"
                  ? "অনুগ্রহ করে আপনার নির্ধারিত কনসাল্টেশন চেম্বারে যান"
                  : "Please proceed to assigned consultation chamber"}
              </p>
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                {activeAnnouncement.serialNumber !== undefined && (
                  <span className="px-3 sm:px-4 py-1 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-mono font-black text-lg sm:text-2xl shadow-xs">
                    {lang === "bn"
                      ? `টোকেন #${formatNumberByLang(activeAnnouncement.serialNumber, lang)}`
                      : `TOKEN #${activeAnnouncement.serialNumber}`}
                  </span>
                )}
                <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl font-black text-foreground tracking-tight drop-shadow-xs">
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
                    {activeAnnouncement.gender === "MALE"
                      ? lang === "bn"
                        ? "পুরুষ"
                        : "MALE"
                      : lang === "bn"
                        ? "মহিলা"
                        : "FEMALE"}
                  </span>
                )}
              </div>
            </div>

            {/* Chamber Callout Box */}
            <div className="p-4 sm:p-6 md:p-8 2xl:p-10 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white border border-sky-300/60 shadow-xl flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-7">
              <div className="p-3 sm:p-4 md:p-5 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner shrink-0">
                <DoorOpen className="size-10 sm:size-14 md:size-16 2xl:size-20 text-white" />
              </div>
              <div className="text-center sm:text-left space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm md:text-base 2xl:text-lg font-bold uppercase tracking-widest text-sky-100/90">
                  {lang === "bn"
                    ? "ডাক্তার কনসাল্টেশন • চেম্বারে প্রবেশ করুন"
                    : `${activeAnnouncement.roomPurpose || "Doctor Consultation"} • PLEASE PROCEED TO`}
                </div>
                <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl 2xl:text-8xl font-black font-mono tracking-tight text-white drop-shadow-md">
                  {lang === "bn"
                    ? `রুম নং ${formatNumberByLang(activeAnnouncement.roomNumber, lang)}`
                    : `ROOM ${activeAnnouncement.roomNumber}`}
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
                  {lang === "bn"
                    ? "ভয়েস ঘোষণা সম্পন্ন • স্বয়ংক্রিয়ভাবে বন্ধ হবে "
                    : "Chime & Voice Broadcast • Clearing automatically in "}
                  <strong className="text-foreground font-black">
                    {formatNumberByLang(countdownSeconds, lang)}
                    {lang === "bn" ? " সেকেন্ডে" : "s"}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. Main Live Queue: High-Density Responsive Grid     */}
      {/* ---------------------------------------------------- */}
      <main
        className={`flex-1 min-h-0 w-full max-w-[2560px] mx-auto p-2 sm:p-3 overflow-visible md:overflow-hidden grid gap-2.5 sm:gap-3 ${
          departmentFilter === "ALL"
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* Column 1: Therapy Queue */}
        {(departmentFilter === "ALL" || departmentFilter === "THERAPY") && (
          <section className="flex flex-col min-h-[360px] md:min-h-0 md:h-full rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xs">
            {/* Compact Column Header */}
            <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Activity className="size-4" />
                </div>
                <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                  {lang === "bn" ? "থেরাপি সিরিয়াল" : "Therapy Queue"}
                </h2>
                <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {formatNumberByLang(therapyQueue.length, lang)}
                </span>
              </div>

              <span className="text-[10.5px] font-semibold text-muted-foreground">
                {lang === "bn" ? "থেরাপি রুমসমূহ" : "Therapy Rooms"}
              </span>
            </div>

            {/* Column Scrollable Content */}
            <div ref={therapyListRef} className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5">
              {therapyQueue.length === 0 ? (
                <EmptyQueueCard
                  title={
                    lang === "bn"
                      ? "থেরাপি সিরিয়াল সম্পূর্ণ খালি"
                      : "Therapy Queue is Clear"
                  }
                />
              ) : (
                <div
                  className={`grid gap-2 auto-rows-max ${
                    departmentFilter === "THERAPY"
                      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                      : "grid-cols-1 xl:grid-cols-2"
                  }`}
                >
                  {therapyQueue.map((item) => (
                    <QueueItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Column 2: Consultation Queue */}
        {(departmentFilter === "ALL" || departmentFilter === "CONSULTATION") && (
          <section className="flex flex-col min-h-[360px] md:min-h-0 md:h-full rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xs">
            {/* Compact Column Header */}
            <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                  <Stethoscope className="size-4" />
                </div>
                <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                  {lang === "bn" ? "কনসাল্টেশন সিরিয়াল" : "Consultation Queue"}
                </h2>
                <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                  {formatNumberByLang(consultationQueue.length, lang)}
                </span>
              </div>

              <span className="text-[10.5px] font-semibold text-muted-foreground">
                {lang === "bn" ? "ডাক্তার চেম্বারসমূহ" : "Doctor Chambers"}
              </span>
            </div>

            {/* Column Scrollable Content */}
            <div ref={consultationListRef} className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5">
              {consultationQueue.length === 0 ? (
                <EmptyQueueCard
                  title={
                    lang === "bn"
                      ? "কনসাল্টেশন সিরিয়াল সম্পূর্ণ খালি"
                      : "Consultation Queue is Clear"
                  }
                />
              ) : (
                <div
                  className={`grid gap-2 auto-rows-max ${
                    departmentFilter === "CONSULTATION"
                      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                      : "grid-cols-1 xl:grid-cols-2"
                  }`}
                >
                  {consultationQueue.map((item) => (
                    <QueueItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* 2.5 Clinical Health & Patient Guidance Marquee Ticker */}
      {/* ---------------------------------------------------- */}
      <div className="w-full bg-primary/10 border-t border-primary/20 py-1.5 px-4 text-xs font-semibold text-foreground overflow-hidden whitespace-nowrap flex items-center gap-3 shrink-0">
        <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider shrink-0 shadow-2xs">
          {lang === "bn" ? "জরুরি নোটিশ" : "CLINIC NOTICE"}
        </span>
        <div className="overflow-hidden relative w-full text-xs text-muted-foreground whitespace-nowrap">
          <div className="inline-block animate-marquee whitespace-nowrap font-medium space-x-6">
            <span>• Please keep your queue token ticket ready when your serial number is called</span>
            <span>• Maintain an upright spinal posture while sitting in the waiting area</span>
            <span>• If experiencing acute pain or dizziness, please notify the reception counter immediately</span>
            <span>• All rooms &amp; therapy modalities are sanitized between patient sessions</span>
            <span>• স্বাস্থ্য বার্তা: বসার সময় মেরুদণ্ড সোজা রাখুন এবং নির্ধারিত টোকেনের জন্য অপেক্ষা করুন</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Screen Footer Ticker (Live Summary Counts)        */}
      {/* ---------------------------------------------------- */}
      <footer className="w-full px-3 sm:px-6 py-1.5 border-t border-border/70 bg-card/75 backdrop-blur-xl shrink-0 shadow-xs z-20 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs">
        {/* Left: Queue Counters & Punctuality Breakdown */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1 font-semibold text-foreground text-[11.5px]">
            <Users className="size-3 text-primary" />
            <span>{lang === "bn" ? "মোট অপেক্ষমান:" : "Total Waiting:"}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold font-mono text-[11px]">
              {formatNumberByLang(stats.total, lang)}
            </span>
          </div>

          <div className="h-3 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>
                {lang === "bn" ? "থেরাপি: " : "Therapy: "}
                {formatNumberByLang(stats.therapyCount, lang)}
              </span>
            </span>

            <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
              <span className="size-1.5 rounded-full bg-sky-500" />
              <span>
                {lang === "bn" ? "কনসাল্টেশন: " : "Consultation: "}
                {formatNumberByLang(stats.consultationCount, lang)}
              </span>
            </span>
          </div>

          <div className="h-3 w-px bg-border hidden md:block" />

          {/* Punctuality counters */}
          <div className="hidden md:flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>
                {lang === "bn" ? "সঠিক সময়ে: " : "On Time: "}
                {formatNumberByLang(stats.greenCount, lang)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>
                {lang === "bn" ? "সামান্য বিলম্ব: " : "Moderate: "}
                {formatNumberByLang(stats.yellowCount, lang)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-500" />
              <span>
                {lang === "bn" ? "দেরি: " : "Late: "}
                {formatNumberByLang(stats.redCount, lang)}
              </span>
            </span>
          </div>
        </div>

        {/* Right: Hospital Notice */}
        <div className="text-[10.5px] text-muted-foreground flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-primary" />
          <span>
            {lang === "bn"
              ? "হেলথ অ্যান্ড পেইন কেয়ার সেন্টার • রিয়েল-টাইম ওয়েটিং হল ডিসপ্লে"
              : "Health And Pain Care Center • Realtime Waiting Hall Display"}
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
  const { lang } = useI18n();
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
          <h3 className="text-xs sm:text-sm 2xl:text-base font-black text-foreground tracking-tight truncate">
            {item.patient?.name || "Patient"}
          </h3>

          <span
            className={`px-1 py-0.2 rounded text-[9px] font-bold shrink-0 border ${
              isMale
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
            }`}
          >
            {isMale ? (lang === "bn" ? "পু" : "M") : (lang === "bn" ? "ম" : "F")}
          </span>

          {item.bookingType === "EXTRA" && (
            <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold shrink-0">
              {lang === "bn" ? "অতিরিক্ত" : "Extra"}
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
              <span>
                {lang === "bn"
                  ? `রুম ${formatNumberByLang(roomNumber, lang)}`
                  : `Room ${roomNumber}`}
              </span>
            </span>
          )}
        </div>

        {/* Late time / punctuality status badge */}
        {isCalling ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black border shrink-0 bg-amber-500 text-white border-amber-600 animate-pulse shadow-xs">
            <Radio className="size-2.5 shrink-0" />
            <span>{lang === "bn" ? "ডাকছেন • CALLING" : "CALLING • ডাকছেন"}</span>
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
            <span>{getLocalizedPunctualityLabel(p, lang)}</span>
          </span>
        )}
      </div>

      {/* Middle Row: Prominent "Will Call Time" or Calling Banner */}
      {isCalling ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-950 dark:text-amber-100 shadow-xs animate-pulse ring-1 ring-amber-500/30">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-200">
            <Radio className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="tracking-wide text-[10.5px] uppercase font-black">
              {lang === "bn" ? "চেম্বারে প্রবেশ করুন:" : "Please Enter Chamber:"}
            </span>
          </div>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-amber-900 dark:text-amber-100 bg-amber-500/30 px-2 py-0.5 rounded border border-amber-500/40">
            {roomNumber
              ? lang === "bn"
                ? `রুম ${formatNumberByLang(roomNumber, lang)}`
                : `Room ${roomNumber}`
              : lang === "bn"
                ? "চেম্বার"
                : "Chamber"}
          </span>
        </div>
      ) : isServing ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-950 dark:text-emerald-100 shadow-2xs animate-pulse">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <DoorOpen className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="tracking-wide text-[10.5px] uppercase font-bold">
              {lang === "bn" ? "চিকিৎসা চলছে:" : "Now In Session:"}
            </span>
          </div>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-emerald-800 dark:text-emerald-200 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
            {roomNumber
              ? lang === "bn"
                ? `রুম ${formatNumberByLang(roomNumber, lang)}`
                : `Room ${roomNumber}`
              : lang === "bn"
                ? "চিকিৎসা চলছে"
                : "In Session"}
          </span>
        </div>
      ) : item.willCallTime ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-sky-500/15 dark:bg-sky-950/50 border border-sky-500/35 text-sky-950 dark:text-sky-100 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
            <Clock className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0 animate-pulse" />
            <span className="tracking-wide text-[10.5px] font-bold">
              {lang === "bn" ? "সম্ভাব্য ডাক:" : "Will Call:"}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-sky-500/20 dark:bg-sky-900/70 px-2 py-0.5 rounded border border-sky-500/30">
            <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-sky-900 dark:text-sky-100">
              {formatNumberByLang(item.willCallTime, lang)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-2.5 py-0.5 rounded bg-muted/25 border border-border/40 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1 text-[9.5px]">
            <Clock className="size-2.5 opacity-60 text-muted-foreground" />
            <span>{lang === "bn" ? "সম্ভাব্য ডাক:" : "Will Call:"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/80 font-sans italic">
            {lang === "bn" ? "হিসাব হচ্ছে..." : "Estimating..."}
          </span>
        </div>
      )}

      {/* Bottom Row: Told Time & In Time */}
      <div className="flex items-center justify-between text-[10px] sm:text-[10.5px] font-mono pt-1 border-t border-border/40 leading-none">
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-[9px] uppercase font-semibold text-muted-foreground/75">
            {lang === "bn" ? "বলা:" : "Told:"}
          </span>
          <span className="font-bold text-foreground">
            {formatNumberByLang(item.toldTime, lang) || "--:--"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase font-semibold text-muted-foreground/75">
            {lang === "bn" ? "প্রবেশ:" : "In:"}
          </span>
          <span className={`font-bold ${p.textClass}`} suppressHydrationWarning>
            {formatNumberByLang(formatTime12h(item.checkInTime), lang)}
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
  const { lang } = useI18n();
  return (
    <div className="h-full min-h-[140px] rounded-xl border border-dashed border-border/50 bg-muted/5 flex flex-col items-center justify-center p-4 text-center space-y-1.5 text-muted-foreground">
      <Users className="size-5 text-muted-foreground/50" />
      <span className="text-xs font-semibold text-foreground/80">{title}</span>
      <span className="text-[10px] font-mono text-muted-foreground/60">
        {lang === "bn"
          ? "নতুন রোগীর চেক-ইনের জন্য অপেক্ষা করা হচ্ছে..."
          : "Listening for real-time check-ins..."}
      </span>
    </div>
  );
}
