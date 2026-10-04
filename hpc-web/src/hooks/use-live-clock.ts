"use client";

import * as React from "react";

let currentTimeValue: Date | null = null;
const listeners = new Set<() => void>();
let timerInterval: ReturnType<typeof setInterval> | null = null;

function subscribeTime(callback: () => void) {
  listeners.add(callback);
  if (!timerInterval && typeof window !== "undefined") {
    currentTimeValue = new Date();
    timerInterval = setInterval(() => {
      currentTimeValue = new Date();
      listeners.forEach((listener) => listener());
    }, 1000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      currentTimeValue = null;
    }
  };
}

function getClientTime(): Date | null {
  if (typeof window === "undefined") return null;
  if (!currentTimeValue) {
    currentTimeValue = new Date();
  }
  return currentTimeValue;
}

function getServerTime(): Date | null {
  return null;
}

export function useLiveClock(): Date | null {
  return React.useSyncExternalStore(
    subscribeTime,
    getClientTime,
    getServerTime,
  );
}
