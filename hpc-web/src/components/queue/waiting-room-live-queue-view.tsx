"use client";

import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import {
  LanguageSwitcher,
  useI18n,
  formatNumberByLang,
  formatDateByLang,
} from "@/lib/i18n";
import { useLiveClock } from "@/hooks/use-live-clock";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import {
  getLiveQueueAction,
  type AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import {
  evaluatePunctuality,
  formatTime12h,
  getLocalizedPunctualityLabel,
} from "@/lib/queue-punctuality";
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

export interface DoctorCallAnnouncement {
  appointmentId: string;
  serialNumber?: number;
  patientName: string;
  gender?: string;
  roomNumber: string;
  roomPurpose?: string;
  timestamp: string;
}

export interface WaitingRoomLiveQueueViewProps {
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
  const [queue, setQueue] = React.useState<AppointmentWithRelations[]>(
    Array.isArray(initialQueue) ? initialQueue : [],
  );
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    const handleFullscreenChange = () => {
      requestWakeLock();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
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

        osc.onended = () => {
          try {
            osc.disconnect();
            gainNode.disconnect();
          } catch {}
        };

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
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !window.speechSynthesis
    )
      return;

    const loadVoices = () => {
      try {
        if (
          typeof window !== "undefined" &&
          window.speechSynthesis &&
          typeof window.speechSynthesis.getVoices === "function"
        ) {
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
        const currentSynth =
          typeof window !== "undefined" && "speechSynthesis" in window
            ? window.speechSynthesis
            : null;
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
        ? `টোকেন ${formatNumberByLang(announcement.serialNumber, "bn")}, `
        : "";

      const enText = `Attention please. ${tokenStr}Patient ${announcement.patientName}. Please proceed to Room ${announcement.roomNumber}.`;
      const bnText = `দয়া করে মনোযোগ দিন। ${tokenStrBn}রোগী ${announcement.patientName}, রুম নম্বর ${formatNumberByLang(announcement.roomNumber, "bn")}-এ আসুন।`;

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
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        window.speechSynthesis
      ) {
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
          }, 1800);
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
      patientName: lang === "bn" ? "পরীক্ষামূলক রোগী" : "Test Patient",
      gender: "FEMALE",
      roomNumber: "1",
      roomPurpose: lang === "bn" ? "ডাক্তার কনসাল্টেশন" : "Doctor Consultation",
      timestamp: new Date().toISOString(),
    });
  }, [unlockAudio, playAnnouncementSound, lang]);

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
      const type = (event?.type || "").toUpperCase();
      if (type === "DOCTOR_CALLED") {
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
      } else if (type !== "CHAT_MESSAGE_SENT" && type !== "CHAT_MESSAGE_DELETED") {
        if (type === "APPOINTMENT_UPDATED" && event.data?.id) {
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
                  ...(d.roomId !== undefined ? { roomId: d.roomId } : {}),
                  ...(d.roomNumber !== undefined
                    ? {
                        room: d.roomNumber
                          ? item.room
                            ? { ...item.room, number: d.roomNumber }
                            : ({ id: d.roomId || "", number: d.roomNumber } as any)
                          : null,
                      }
                    : {}),
                };
              }
              return item;
            }),
          );
          if (
            (d.status === "CHECKED_IN" ||
              d.status === "IN_CONSULTATION" ||
              d.status === "IN_THERAPY" ||
              d.status === "COMPLETED" ||
              d.status === "CANCELLED") &&
            activeAnnouncement?.appointmentId === d.id
          ) {
            setActiveAnnouncement(null);
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
          }
        }
        refreshQueue();
      }
    },
    onReconnect: () => {
      refreshQueue();
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

      // Smart TV Remote Back Key Handling (Samsung Tizen 10009, LG webOS 461, Android TV Back)
      const isBackKey =
        (e as any).keyCode === 10009 ||
        (e as any).keyCode === 461 ||
        e.key === "GoBack" ||
        e.key === "Back";

      if (isBackKey) {
        e.preventDefault();
        if (activeAnnouncement) {
          setActiveAnnouncement(null);
          return;
        }
        if (typeof document !== "undefined" && document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
          return;
        }
      }

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
    let atBottomPauseCycles = 0;

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

        // If at bottom, pause for 1 tick, then smoothly return to top
        if (
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - 12
        ) {
          atBottomPauseCycles++;
          if (atBottomPauseCycles >= 2) {
            container.scrollTo({ top: 0, behavior: "smooth" });
            atBottomPauseCycles = 0;
          }
        } else {
          atBottomPauseCycles = 0;
          container.scrollBy({ top: 140, behavior: "smooth" });
        }
      });
    }, 6000);

    return () => clearInterval(autoScrollInterval);
  }, [activeAnnouncement]);

  // Formatted digital clock strings
  const formattedTime = currentTime
    ? lang === "bn"
      ? formatNumberByLang(
          currentTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }),
          "bn",
        )
      : currentTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
    : "--:--:--";

  const formattedDate = currentTime
    ? formatDateByLang(currentTime, lang)
    : initialDate;

  // Split queue into 2 distinct columns: Therapy Queue & Consultation Queue
  const therapyQueue = React.useMemo(() => {
    return (queue || []).filter(
      (item) =>
        (item?.queueType === "THERAPY" || Boolean(item?.therapySlotId)) &&
        !item?.outTherapyTime &&
        item?.currentStation !== "CASHIER_REGISTER" &&
        item?.currentStation !== "RECEPTIONIST_DESK" &&
        item?.currentStation !== "CHECKED_OUT",
    );
  }, [queue]);

  const consultationQueue = React.useMemo(() => {
    return (queue || []).filter(
      (item) =>
        item?.queueType === "CONSULTATION" &&
        !item?.outConsultationTime &&
        item?.currentStation !== "CASHIER_REGISTER" &&
        item?.currentStation !== "RECEPTIONIST_DESK" &&
        item?.currentStation !== "CHECKED_OUT",
    );
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
          title={lang === "bn" ? "স্টাফ লগইন পোর্টাল" : "Staff Login"}
          className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
        >
          <LogIn className="size-3.5 sm:size-4 2xl:size-4.5" />
        </Link>
      );
    }

    const destination = getRoleDashboard(currentUser.role);

    switch (currentUser.role) {
      case Role.ADMIN:
        return (
          <Link
            href={destination}
            title={lang === "bn" ? "অ্যাডমিন পোর্টাল" : "Admin Portal"}
            className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-purple-500/30 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <Shield className="size-3.5 sm:size-4 2xl:size-4.5" />
          </Link>
        );
      case Role.DOCTOR:
        return (
          <Link
            href={destination}
            title={
              lang === "bn"
                ? "ডাক্তার কনসাল্টেশন ডেস্ক"
                : "Doctor Consultation Desk"
            }
            className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <Stethoscope className="size-3.5 sm:size-4 2xl:size-4.5" />
          </Link>
        );
      case Role.RECEPTIONIST:
        return (
          <Link
            href={destination}
            title={lang === "bn" ? "রিসেপশনিস্ট ডেস্ক" : "Receptionist Desk"}
            className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <ClipboardList className="size-3.5 sm:size-4 2xl:size-4.5" />
          </Link>
        );
      case Role.HANDLER:
        return (
          <Link
            href={destination}
            title={
              lang === "bn" ? "ফিজিওথেরাপি ফ্লোর ডেস্ক" : "Physical Therapy Desk"
            }
            className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <Activity className="size-3.5 sm:size-4 2xl:size-4.5" />
          </Link>
        );
      case Role.CASHIER:
        return (
          <Link
            href={destination}
            title={
              lang === "bn" ? "ক্যাশিয়ার ও বিলিং ডেস্ক" : "Billing & Cashier Desk"
            }
            className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <CreditCard className="size-3.5 sm:size-4 2xl:size-4.5" />
          </Link>
        );
      default:
        return (
          <Link
            href={destination}
            title={lang === "bn" ? "স্টাফ পোর্টাল" : "Staff Portal"}
            className="size-7 sm:size-8 2xl:size-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
          >
            <LogIn className="size-3.5 sm:size-4 2xl:size-4.5" />
          </Link>
        );
    }
  };

  return (
    <div className="min-h-screen lg:h-dvh lg:max-h-dvh w-full max-w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden flex flex-col justify-between bg-white dark:bg-black text-zinc-950 dark:text-white select-none pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] transition-colors duration-200">
      {/* ---------------------------------------------------- */}
      {/* 1. Header (Adaptive Across Mobile to 4K TV)          */}
      {/* ---------------------------------------------------- */}
      <header className="w-full px-2.5 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 flex items-center justify-between gap-2 sm:gap-3 border-b border-zinc-200 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shrink-0 shadow-xs z-20">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <BrandLogo
            size="sm"
            variant="compact"
            className="inline-flex sm:hidden"
          />
          <BrandLogo
            size="sm"
            variant="full"
            className="hidden sm:inline-flex 3xl:scale-110 3xl:origin-left"
          />
        </div>

        {/* Center: Live Digital Clock & Date */}
        <div className="flex items-center justify-center shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 shadow-2xs 3xl:px-5 3xl:py-2">
            <Clock className="size-3 sm:size-4 3xl:size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex items-baseline gap-1 sm:gap-2 leading-none font-mono">
              <span
                className="text-[11px] sm:text-sm md:text-base 2xl:text-lg 3xl:text-2xl font-black text-zinc-950 dark:text-white"
                suppressHydrationWarning
              >
                {formattedTime}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">&bull;</span>
              <span
                className="text-[10px] sm:text-xs 2xl:text-sm 3xl:text-base text-zinc-500 dark:text-zinc-400 font-sans hidden md:inline"
                suppressHydrationWarning
              >
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Department Switcher (Desktop), Connection Badge, Audio, Language, Theme, Portal */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {/* Department View Switcher (Desktop / TV: xl and up only) */}
          <div className="hidden xl:flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setDepartmentFilter("ALL")}
              className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                departmentFilter === "ALL"
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-2xs font-black"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {lang === "bn" ? "সকল" : "All"}
            </button>
            <button
              type="button"
              onClick={() => setDepartmentFilter("CONSULTATION")}
              className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                departmentFilter === "CONSULTATION"
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-2xs font-black"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {lang === "bn" ? "চেম্বার" : "Chambers"}
            </button>
            <button
              type="button"
              onClick={() => setDepartmentFilter("THERAPY")}
              className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                departmentFilter === "THERAPY"
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-2xs font-black"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {lang === "bn" ? "থেরাপি" : "Therapy"}
            </button>
          </div>

          {/* Screen Wake Lock Status Badge (TV / Ultra-wide only) */}
          <div
            className={`hidden 2xl:flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] 2xl:text-xs font-semibold border ${
              isWakeLockActive
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
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
            <Tv className="size-2.5 sm:size-3" />
            <span>
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
            className={`flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-lg text-[10px] 2xl:text-xs font-semibold border ${
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse"
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
                <Wifi className="size-2.5 sm:size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden 2xl:inline">
                  {lang === "bn" ? "লাইভ" : "Live"}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="size-2.5 sm:size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="hidden 2xl:inline">
                  {lang === "bn" ? "সিঙ্ক..." : "Syncing..."}
                </span>
              </>
            )}
          </div>

          {/* Offline Audio / Speech Controls */}
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 shadow-2xs">
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
              className={`size-6.5 sm:size-7.5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                isAudioEnabled
                  ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  : "text-zinc-400 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {isAudioEnabled ? (
                <Volume2 className="size-3 sm:size-3.5" />
              ) : (
                <VolumeX className="size-3 sm:size-3.5" />
              )}
            </button>

            {/* Test Audio Button (Collapsed on < 2xl) */}
            <button
              type="button"
              onClick={testAnnouncementSound}
              title={
                lang === "bn"
                  ? "সাউন্ড টেস্ট: অফলাইন হসপিটাল বেল ও ভয়েস ঘোষণা শুনুন"
                  : "Test Sound: Play offline hospital chime & speech announcement"
              }
              className="hidden 2xl:flex h-7 px-1.5 text-[10px] font-bold rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 items-center gap-1 cursor-pointer transition-colors"
            >
              <Bell className="size-2.5 text-emerald-600 animate-pulse" />
              <span>{lang === "bn" ? "সাউন্ড টেস্ট" : "Test Sound"}</span>
            </button>
          </div>

          <LanguageSwitcher className="h-6.5 sm:h-8 px-1 sm:px-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] sm:text-xs shadow-2xs" />
          <FullscreenToggle className="size-6.5 sm:size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40 cursor-pointer flex items-center justify-center shrink-0 shadow-2xs transition-colors" />
          <ThemeToggle variant="compact" className="size-6.5 sm:size-8" />
          {renderUserPortalButton()}
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 1.2. Responsive Department Switcher (Mobile & Tablet) */}
      {/* ---------------------------------------------------- */}
      <nav
        aria-label="Department view switcher"
        className="xl:hidden w-full px-2.5 sm:px-4 py-1 sm:py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0 z-10 flex items-center justify-center"
      >
        <div className="w-full max-w-lg grid grid-cols-3 bg-zinc-200/70 dark:bg-zinc-800/80 p-0.5 sm:p-1 rounded-xl text-center shadow-inner">
          <button
            type="button"
            onClick={() => setDepartmentFilter("ALL")}
            className={`py-1 sm:py-1.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              departmentFilter === "ALL"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs font-black"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <span>{lang === "bn" ? "সকল" : "All"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs font-mono font-bold ${
                departmentFilter === "ALL"
                  ? "bg-white/20 text-white"
                  : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {formatNumberByLang(stats.total, lang)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDepartmentFilter("CONSULTATION")}
            className={`py-1 sm:py-1.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              departmentFilter === "CONSULTATION"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs font-black"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Stethoscope className="size-3.5 sm:size-4 shrink-0" />
            <span>{lang === "bn" ? "চেম্বার" : "Chambers"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs font-mono font-bold ${
                departmentFilter === "CONSULTATION"
                  ? "bg-white/20 text-white"
                  : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {formatNumberByLang(consultationQueue.length, lang)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDepartmentFilter("THERAPY")}
            className={`py-1 sm:py-1.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              departmentFilter === "THERAPY"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs font-black"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Activity className="size-3.5 sm:size-4 shrink-0" />
            <span>{lang === "bn" ? "থেরাপি" : "Therapy"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs font-mono font-bold ${
                departmentFilter === "THERAPY"
                  ? "bg-white/20 text-white"
                  : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {formatNumberByLang(therapyQueue.length, lang)}
            </span>
          </button>
        </div>
      </nav>

      {/* ---------------------------------------------------- */}
      {/* 1.5. Realtime Doctor Calling Large Popup Announcement */}
      {/* ---------------------------------------------------- */}
      {activeAnnouncement && (
        <aside
          role="status"
          aria-live="assertive"
          aria-label="Doctor Calling Announcement"
          className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center p-2.5 sm:p-4 md:p-6 lg:p-8 bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 select-none overflow-hidden"
        >
          <div className="w-full max-w-[96vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl p-4 sm:p-6 md:p-8 2xl:p-12 3xl:p-16 rounded-2xl sm:rounded-3xl md:rounded-4xl 3xl:rounded-[2.5rem] border-2 sm:border-4 3xl:border-8 border-emerald-500 dark:border-emerald-500 bg-white dark:bg-zinc-950 shadow-[0_0_80px_rgba(16,185,129,0.25)] dark:shadow-[0_0_120px_rgba(16,185,129,0.4)] space-y-3 sm:space-y-4 md:space-y-6 text-center relative overflow-hidden ring-4 sm:ring-8 3xl:ring-12 ring-emerald-500/20 flex flex-col justify-between my-auto text-zinc-950 dark:text-white">
            {/* Animated Ambient Radial Glows */}
            <div className="absolute -top-32 -left-32 w-72 md:w-96 h-72 md:h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-32 -right-32 w-72 md:w-96 h-72 md:h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

            {/* Calling Header Pill */}
            <div className="inline-flex items-center self-center gap-2 sm:gap-3 px-3 sm:px-6 py-1 sm:py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm md:text-base 2xl:text-xl font-black tracking-widest uppercase shadow-xs animate-pulse">
              <Megaphone className="size-4 sm:size-5 2xl:size-6 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              <span>
                {lang === "bn"
                  ? "রোগীকে ডাকা হচ্ছে • NOW CALLING PATIENT"
                  : "NOW CALLING PATIENT • ডাক্তার ডাকছেন"}
              </span>
              <Volume2 className="size-4 sm:size-5 2xl:size-6 text-emerald-600 dark:text-emerald-400" />
            </div>

            {/* Patient Name Section */}
            <div className="space-y-1.5 sm:space-y-3">
              <p className="text-[11px] sm:text-xs md:text-sm 2xl:text-lg uppercase tracking-widest font-mono text-zinc-500 dark:text-zinc-400 font-bold">
                {lang === "bn"
                  ? "অনুগ্রহ করে আপনার নির্ধারিত কনসাল্টেশন চেম্বারে যান"
                  : "Please proceed to assigned consultation chamber"}
              </p>
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                {activeAnnouncement.serialNumber !== undefined && (
                  <span className="px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-mono font-black text-base sm:text-xl md:text-2xl 2xl:text-3xl 3xl:text-4xl shadow-xs">
                    {lang === "bn"
                      ? `টোকেন #${formatNumberByLang(activeAnnouncement.serialNumber, lang)}`
                      : `TOKEN #${activeAnnouncement.serialNumber}`}
                  </span>
                )}
                <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl 3xl:text-8xl font-black text-zinc-950 dark:text-white tracking-tight drop-shadow-xs break-words">
                  {activeAnnouncement.patientName}
                </h2>
                {activeAnnouncement.gender && (
                  <span
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm 2xl:text-base font-black uppercase tracking-wider border shadow-2xs ${
                      activeAnnouncement.gender === "MALE"
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700"
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
            <div className="p-4 sm:p-6 md:p-8 2xl:p-10 3xl:p-14 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 dark:from-emerald-700 dark:via-emerald-800 dark:to-zinc-900 text-white border border-emerald-400/50 shadow-xl flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 2xl:gap-8">
              <div className="p-3 sm:p-4 md:p-5 2xl:p-6 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner shrink-0">
                <DoorOpen className="size-10 sm:size-14 md:size-16 2xl:size-20 3xl:size-24 text-white" />
              </div>
              <div className="text-center sm:text-left space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm md:text-base 2xl:text-xl font-bold uppercase tracking-widest text-emerald-100">
                  {lang === "bn"
                    ? "ডাক্তার কনসাল্টেশন • চেম্বারে প্রবেশ করুন"
                    : `${activeAnnouncement.roomPurpose || "Doctor Consultation"} • PLEASE PROCEED TO`}
                </div>
                <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl 2xl:text-8xl 3xl:text-9xl font-black font-mono tracking-tight text-white drop-shadow-md">
                  {lang === "bn"
                    ? `রুম নং ${formatNumberByLang(activeAnnouncement.roomNumber, lang)}`
                    : `ROOM ${activeAnnouncement.roomNumber}`}
                </div>
              </div>
            </div>

            {/* Visual Countdown Progress Bar & Kiosk Auto-Dismiss Status */}
            <div className="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <div className="w-full h-2 sm:h-2.5 2xl:h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(countdownSeconds / 16) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm 2xl:text-base font-mono text-zinc-500 dark:text-zinc-400">
                <Volume2 className="size-3.5 sm:size-4 2xl:size-5 text-emerald-500 animate-pulse shrink-0" />
                <span>
                  {lang === "bn"
                    ? "ভয়েস ঘোষণা সম্পন্ন • স্বয়ংক্রিয়ভাবে বন্ধ হবে "
                    : "Chime & Voice Broadcast • Clearing automatically in "}
                  <strong className="text-zinc-950 dark:text-white font-black">
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
      {/* 2. Main Live Queue: Responsive Adaptive Layout       */}
      {/* ---------------------------------------------------- */}
      <main
        className={`flex-1 min-h-0 w-full max-w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 overflow-y-auto lg:overflow-hidden grid gap-2 sm:gap-2.5 md:gap-3 ${
          departmentFilter === "ALL"
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* Column 1: Therapy Queue */}
        {(departmentFilter === "ALL" || departmentFilter === "THERAPY") && (
          <section className="flex flex-col min-h-[150px] sm:min-h-[200px] lg:min-h-0 lg:h-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
            {/* Column Header */}
            <div className="px-2.5 sm:px-3.5 2xl:px-5 py-1.5 sm:py-2 2xl:py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-900/70 shrink-0">
              <div className="flex items-center gap-1.5 2xl:gap-2.5">
                <div className="p-1 2xl:p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <Activity className="size-3.5 2xl:size-5" />
                </div>
                <h2 className="text-xs sm:text-sm 2xl:text-lg 3xl:text-xl font-bold sm:font-extrabold tracking-normal text-zinc-950 dark:text-white">
                  {lang === "bn" ? "থেরাপি সিরিয়াল" : "Therapy Queue"}
                </h2>
                <span className="px-1.5 2xl:px-2.5 py-0.2 2xl:py-0.5 rounded-full text-[11px] 2xl:text-sm font-mono font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  {formatNumberByLang(therapyQueue.length, lang)}
                </span>
              </div>

              <span className="text-[10px] sm:text-[11px] 2xl:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? "থেরাপি রুমসমূহ" : "Therapy Rooms"}
              </span>
            </div>

            {/* Column Scrollable Content */}
            <div
              ref={therapyListRef}
              className="flex-1 min-h-0 overflow-y-auto p-1.5 sm:p-2 2xl:p-2.5 flex flex-col"
            >
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
                  className={`grid gap-1.5 sm:gap-2 2xl:gap-2.5 auto-rows-max ${
                    departmentFilter === "THERAPY"
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2500px]:grid-cols-6 min-[3200px]:grid-cols-7"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 min-[2200px]:grid-cols-3 min-[3000px]:grid-cols-4"
                  }`}
                >
                  {therapyQueue.map((item, idx) => (
                    <QueueItemCard
                      key={item.id}
                      item={item}
                      serialNumber={item.serialNumber ?? idx + 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Column 2: Consultation Queue */}
        {(departmentFilter === "ALL" || departmentFilter === "CONSULTATION") && (
          <section className="flex flex-col min-h-[150px] sm:min-h-[200px] lg:min-h-0 lg:h-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
            {/* Column Header */}
            <div className="px-2.5 sm:px-3.5 2xl:px-5 py-1.5 sm:py-2 2xl:py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-900/70 shrink-0">
              <div className="flex items-center gap-1.5 2xl:gap-2.5">
                <div className="p-1 2xl:p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <Stethoscope className="size-3.5 2xl:size-5" />
                </div>
                <h2 className="text-xs sm:text-sm 2xl:text-lg 3xl:text-xl font-bold sm:font-extrabold tracking-normal text-zinc-950 dark:text-white">
                  {lang === "bn" ? "কনসাল্টেশন সিরিয়াল" : "Consultation Queue"}
                </h2>
                <span className="px-1.5 2xl:px-2.5 py-0.2 2xl:py-0.5 rounded-full text-[11px] 2xl:text-sm font-mono font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  {formatNumberByLang(consultationQueue.length, lang)}
                </span>
              </div>

              <span className="text-[10px] sm:text-[11px] 2xl:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? "ডাক্তার চেম্বারসমূহ" : "Doctor Chambers"}
              </span>
            </div>

            {/* Column Scrollable Content */}
            <div
              ref={consultationListRef}
              className="flex-1 min-h-0 overflow-y-auto p-1.5 sm:p-2 2xl:p-2.5 flex flex-col"
            >
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
                  className={`grid gap-1.5 sm:gap-2 2xl:gap-2.5 auto-rows-max ${
                    departmentFilter === "CONSULTATION"
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2500px]:grid-cols-6 min-[3200px]:grid-cols-7"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 min-[2200px]:grid-cols-3 min-[3000px]:grid-cols-4"
                  }`}
                >
                  {consultationQueue.map((item, idx) => (
                    <QueueItemCard
                      key={item.id}
                      item={item}
                      serialNumber={item.serialNumber ?? idx + 1}
                    />
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
      <div className="w-full bg-zinc-100 dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800 py-1 px-2.5 sm:px-4 text-xs font-semibold text-zinc-900 dark:text-zinc-100 overflow-hidden whitespace-nowrap flex items-center gap-2 sm:gap-2.5 shrink-0">
        <span className="bg-emerald-600 dark:bg-emerald-500 text-white text-[9px] sm:text-[9.5px] 2xl:text-xs px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 shadow-2xs">
          {lang === "bn" ? "জরুরি নোটিশ" : "CLINIC NOTICE"}
        </span>
        <div className="overflow-hidden relative w-full text-[10.5px] sm:text-[11.5px] 2xl:text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
          <div className="inline-block animate-marquee whitespace-nowrap font-medium space-x-6 sm:space-x-8">
            {lang === "bn" ? (
              <>
                <span>• সিরিয়াল ডাকা হলে অনুগ্রহ করে টোকেন টিকিটটি সাথে রাখুন</span>
                <span>• ওয়েটিং রুমে বসার সময় মেরুদণ্ড সোজা রাখুন</span>
                <span>• তীব্র ব্যথা বা মাথা ঘোরা অনুভব করলে অবিলম্বে রিসেপশন কাউন্টারে জানান</span>
                <span>• প্রতিটি রোগীর সেশনের পর রুম এবং থেরাপির যন্ত্রপাতি জীবাণুমুক্ত করা হয়</span>
                <span>• স্বাস্থ্যই সকল সুখের মূল - হেলথ অ্যান্ড পেইন কেয়ার সেন্টার (যশোর)</span>
              </>
            ) : (
              <>
                <span>• Please keep your queue token ticket ready when your serial number is called</span>
                <span>• Maintain an upright spinal posture while sitting in the waiting area</span>
                <span>• If experiencing acute pain or dizziness, please notify the reception counter immediately</span>
                <span>• All rooms &amp; therapy modalities are sanitized between patient sessions</span>
                <span>• Health And Pain Care Center (Jashore) • Caring for your spinal &amp; joint health</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Screen Footer Ticker (Live Summary Counts)        */}
      {/* ---------------------------------------------------- */}
      <footer className="w-full px-2.5 sm:px-4 md:px-5 py-1 sm:py-1.5 border-t border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-black shrink-0 shadow-xs z-20 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-zinc-900 dark:text-white">
        {/* Left: Queue Counters & Punctuality Breakdown */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-center sm:justify-start">
          <div className="flex items-center gap-1 font-semibold text-zinc-950 dark:text-white text-[10.5px] sm:text-[11px] 2xl:text-sm">
            <Users className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>{lang === "bn" ? "মোট অপেক্ষমান:" : "Total Waiting:"}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold font-mono text-[10.5px] sm:text-[11px]">
              {formatNumberByLang(stats.total, lang)}
            </span>
          </div>

          <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2 text-[10px] sm:text-[10.5px] 2xl:text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>
                {lang === "bn" ? "থেরাপি: " : "Therapy: "}
                {formatNumberByLang(stats.therapyCount, lang)}
              </span>
            </span>

            <span className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>
                {lang === "bn" ? "কনসাল্টেশন: " : "Consultation: "}
                {formatNumberByLang(stats.consultationCount, lang)}
              </span>
            </span>
          </div>

          <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

          {/* Punctuality counters */}
          <div className="hidden md:flex items-center gap-2 text-[10px] 2xl:text-xs text-zinc-500 dark:text-zinc-400">
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
        <div className="text-[10px] 2xl:text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
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
 * Ultra-compact, 2-row high-density patient queue card designed for TV display visibility.
 * Row 1: Token #, Full Patient Name (with dedicated width so it never truncates prematurely), Gender tag, and Status Badge.
 * Row 2: Room / Will-Call status on the left + Told & Check-In timestamps on the right.
 */
function QueueItemCard({
  item,
  serialNumber,
}: {
  item: AppointmentWithRelations;
  serialNumber: number;
}) {
  const { lang } = useI18n();
  const p = evaluatePunctuality(item.toldTime, item.checkInTime);
  const isMale = item.gender === "MALE";
  const isFemale = item.gender === "FEMALE";
  const roomNumber = item.room?.number || item.therapySlot?.room?.number;
  const isCalling = item.status === "CALLING";
  const isServing =
    item.status === "IN_THERAPY" || item.status === "IN_CONSULTATION";

  return (
    <div
      className={`rounded-xl border px-2.5 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-2.5 flex flex-col justify-between gap-1.5 shadow-2xs transition-all duration-150 ${
        isCalling
          ? "bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-sm"
          : isServing
            ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-500/50"
            : `${p.cardClass} ${p.borderClass} bg-white dark:bg-zinc-950`
      }`}
    >
      {/* Row 1: Token #, Full Patient Name, Gender tag, and Compact Status Badge */}
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Token Badge */}
          <span className="px-1.5 2xl:px-2 py-0.2 rounded font-mono font-black text-[10px] sm:text-[11px] 2xl:text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 shrink-0">
            #{formatNumberByLang(serialNumber, lang)}
          </span>

          {/* Full Patient Name — given full flex width without redundant room/bilingual badges */}
          <h3
            title={item.patient?.name || "Patient"}
            className="text-xs sm:text-[13.5px] 2xl:text-base 3xl:text-lg font-extrabold text-zinc-950 dark:text-white tracking-tight leading-snug break-words line-clamp-1 min-w-0"
          >
            {item.patient?.name || (lang === "bn" ? "রোগী" : "Patient")}
          </h3>

          {/* Compact Gender Tag */}
          <span
            className={`px-1 py-0.2 rounded text-[9px] 2xl:text-[11px] font-bold shrink-0 border ${
              isMale
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                : isFemale
                  ? "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                  : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
            }`}
          >
            {isMale
              ? lang === "bn"
                ? "পু"
                : "M"
              : isFemale
                ? lang === "bn"
                  ? "ম"
                  : "F"
                : lang === "bn"
                  ? "অ"
                  : "O"}
          </span>

          {item.bookingType === "EXTRA" && (
            <span className="px-1 py-0.2 rounded text-[8.5px] 2xl:text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold shrink-0">
              {lang === "bn" ? "অতিরিক্ত" : "Extra"}
            </span>
          )}
        </div>

        {/* Right Status / Punctuality Pill */}
        {isCalling ? (
          <span className="inline-flex items-center gap-1 px-1.5 2xl:px-2 py-0.5 rounded-md text-[9px] sm:text-[9.5px] 2xl:text-xs font-black border shrink-0 bg-emerald-600 text-white border-emerald-700 animate-pulse shadow-2xs">
            <Radio className="size-2.5 2xl:size-3 shrink-0" />
            <span>{lang === "bn" ? "ডাকছেন" : "CALLING"}</span>
          </span>
        ) : isServing ? (
          <span className="inline-flex items-center gap-1 px-1.5 2xl:px-2 py-0.5 rounded-md text-[9px] sm:text-[9.5px] 2xl:text-xs font-black border shrink-0 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40">
            <DoorOpen className="size-2.5 2xl:size-3 shrink-0" />
            <span>{lang === "bn" ? "চলছে" : "IN ROOM"}</span>
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 2xl:px-2 py-0.2 rounded-md text-[9px] sm:text-[9.5px] 2xl:text-xs font-bold border shrink-0 ${p.badgeClass}`}
          >
            {p.status === "green" ? (
              <CheckCircle2 className="size-2.5 2xl:size-3 shrink-0" />
            ) : p.status === "yellow" ? (
              <AlertCircle className="size-2.5 2xl:size-3 shrink-0" />
            ) : (
              <AlertTriangle className="size-2.5 2xl:size-3 shrink-0" />
            )}
            <span>{getLocalizedPunctualityLabel(p, lang)}</span>
          </span>
        )}
      </div>

      {/* Row 2: Combined Compact Action/Room/Will-Call Bar + Told/In Timestamps */}
      <div
        className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg border text-[10px] sm:text-[10.5px] 2xl:text-xs leading-none ${
          isCalling
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 animate-pulse"
            : isServing
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
              : "bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800/90 text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {/* Left side: Room Destination or Will-Call Estimate */}
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {isCalling ? (
            <>
              <DoorOpen className="size-3 2xl:size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold uppercase tracking-tight text-[9.5px] sm:text-[10px] 2xl:text-xs text-emerald-800 dark:text-emerald-200">
                {lang === "bn" ? "প্রবেশ করুন:" : "Enter:"}
              </span>
              <span className="font-black font-mono text-emerald-900 dark:text-emerald-100 bg-emerald-500/25 px-1.5 py-0.5 rounded border border-emerald-500/40">
                {roomNumber
                  ? lang === "bn"
                    ? `রুম ${formatNumberByLang(roomNumber, lang)}`
                    : `Room ${roomNumber}`
                  : lang === "bn"
                    ? "চেম্বার"
                    : "Chamber"}
              </span>
            </>
          ) : isServing ? (
            <>
              <DoorOpen className="size-3 2xl:size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {roomNumber
                  ? lang === "bn"
                    ? `রুম ${formatNumberByLang(roomNumber, lang)}-এ চলছে`
                    : `In Room ${roomNumber}`
                  : lang === "bn"
                    ? "চিকিৎসা চলছে"
                    : "In Session"}
              </span>
            </>
          ) : item.willCallTime ? (
            <>
              <Clock className="size-2.5 2xl:size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {lang === "bn" ? "ডাক:" : "Call:"}
              </span>
              <span className="font-black font-mono text-emerald-800 dark:text-emerald-200">
                {formatNumberByLang(item.willCallTime, lang)}
              </span>
              {roomNumber && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {lang === "bn"
                    ? `রুম ${formatNumberByLang(roomNumber, lang)}`
                    : `R${roomNumber}`}
                </span>
              )}
            </>
          ) : (
            <>
              <Clock className="size-2.5 2xl:size-3 opacity-60 shrink-0" />
              <span className="text-[9.5px] 2xl:text-[11px] text-zinc-500 dark:text-zinc-400">
                {roomNumber
                  ? lang === "bn"
                    ? `রুম ${formatNumberByLang(roomNumber, lang)} • অপেক্ষমান`
                    : `Room ${roomNumber} • Waiting`
                  : lang === "bn"
                    ? "সিরিয়ালে অপেক্ষমান"
                    : "Waiting in Queue"}
              </span>
            </>
          )}
        </div>

        {/* Right side: Told & In Times */}
        <div className="flex items-center gap-2 font-mono text-[9.5px] sm:text-[10px] 2xl:text-xs shrink-0">
          {item.toldTime && (
            <span className="text-zinc-500 dark:text-zinc-400">
              <span className="text-[8.5px] uppercase opacity-75 mr-0.5">
                {lang === "bn" ? "বলা:" : "Told:"}
              </span>
              <strong className="text-zinc-800 dark:text-zinc-200">
                {formatNumberByLang(item.toldTime, lang)}
              </strong>
            </span>
          )}
          <span>
            <span className="text-[8.5px] uppercase text-zinc-400 dark:text-zinc-500 mr-0.5">
              {lang === "bn" ? "প্রবেশ:" : "In:"}
            </span>
            <strong className={p.textClass} suppressHydrationWarning>
              {formatNumberByLang(formatTime12h(item.checkInTime), lang)}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Clean, high-visibility empty state for a clear queue
 */
function EmptyQueueCard({ title }: { title: string }) {
  const { lang } = useI18n();
  return (
    <div className="flex-1 min-h-[120px] sm:min-h-[150px] lg:min-h-[180px] 2xl:min-h-[280px] rounded-xl flex flex-col items-center justify-center p-3 sm:p-4 lg:p-6 2xl:p-12 text-center space-y-2 sm:space-y-2.5 2xl:space-y-4 text-zinc-400 dark:text-zinc-500 my-auto">
      <div className="relative p-2.5 sm:p-3.5 2xl:p-6 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center">
        <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-emerald-500/10 animate-ping opacity-25" />
        <Users className="size-5 sm:size-7 2xl:size-12 text-emerald-600 dark:text-emerald-400 relative z-10" />
      </div>
      <div className="space-y-0.5 sm:space-y-1 max-w-md">
        <h3 className="text-xs sm:text-sm md:text-base 2xl:text-xl font-bold sm:font-extrabold text-zinc-800 dark:text-zinc-100 tracking-normal">
          {title}
        </h3>
        <p className="text-[10.5px] sm:text-xs 2xl:text-base font-mono text-zinc-500 dark:text-zinc-400 tracking-normal">
          {lang === "bn"
            ? "নতুন রোগীর চেক-ইনের জন্য অপেক্ষা করা হচ্ছে • লাইভ মনিটরিং সক্রিয়"
            : "Listening for real-time check-ins • Live system monitoring active"}
        </p>
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 2xl:px-3.5 2xl:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9.5px] sm:text-[11px] 2xl:text-xs font-bold font-mono">
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>
          {lang === "bn" ? "অপেক্ষমান তালিকা শূন্য" : "Queue Empty / Standby"}
        </span>
      </div>
    </div>
  );
}
