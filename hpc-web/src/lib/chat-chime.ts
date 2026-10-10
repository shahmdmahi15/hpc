/**
 * Offline Web Audio Chime & Browser Notifications for Clinic Real-Time Chat
 * Ensures 100% offline, zero-asset audio playback with browser gesture auto-unlock.
 */

let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

export const SYSTEM_CHANNEL_NAMES: Record<string, string> = {
  GENERAL: "General Broadcast",
  CLINICAL: "Doctors & Clinical",
  RECEPTION: "Reception & Arrivals",
  THERAPY: "Therapy Floor & Handlers",
  CASHIER: "Cashier & Billing",
};

export function getChannelDisplayName(channelId: string): string {
  if (SYSTEM_CHANNEL_NAMES[channelId]) {
    return SYSTEM_CHANNEL_NAMES[channelId];
  }
  return channelId;
}

/**
 * Lazily obtains or creates the shared AudioContext, ensuring it resumes if suspended.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Silently auto-unlocks Web Audio on first user interaction (touch, pointer, key, or click).
 * This bypasses modern browser autoplay policy restrictions for background alarms/chimes.
 */
if (typeof window !== "undefined") {
  const unlockEvents = ["click", "pointerdown", "keydown", "touchstart"];
  const unlockHandler = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      isAudioUnlocked = true;
    } catch {}
    unlockEvents.forEach((e) => window.removeEventListener(e, unlockHandler));
  };

  unlockEvents.forEach((e) =>
    window.addEventListener(e, unlockHandler, { once: true, passive: true }),
  );
}

/**
 * Plays a pleasant, high-audibility clinical floor chime.
 * Urgent messages play a 3-tone ascending alert; regular messages play a 2-tone melodic chime.
 */
export function playChatChime(isUrgent = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isUrgent) {
      // 3-Tone Urgent Clinical Chime: A5 (880Hz) -> D6 (1174Hz) -> F#6 (1480Hz)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.1);
      osc.frequency.setValueAtTime(1479.98, now + 0.2);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // 2-Tone Melodic Clinical Floor Chime: D5 (587.33Hz) -> A5 (880Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    console.error("[Chat Chime Audio Error]:", err);
  }
}

/**
 * Triggers native HTML5 browser notification if permission has been granted.
 */
export function showChatBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/icon.png",
        silent: true, // We already handle custom Web Audio chime
      });
      // Auto close after 5 seconds
      setTimeout(() => notif.close(), 5000);
    } catch {}
  } else if (Notification.permission === "default") {
    // Silently request permission for subsequent notifications
    Notification.requestPermission().catch(() => {});
  }
}
