"use client";

import * as React from "react";

/**
 * Global audio unlocker that seamlessly unlocks browser Web Audio autoplay policy
 * on the user's first click, tap, or keypress during the 10:00 AM - 8:00 PM clinic session.
 */
export function AudioUnlocker() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let unlocked = false;

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
          // Play a silent 1ms buffer to satisfy browser user gesture requirement
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        }
      } catch {
        // Ignore audio context initialization issues
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return null;
}
