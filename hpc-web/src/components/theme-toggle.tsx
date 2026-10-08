"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";

import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

interface ThemeToggleProps {
  className?: string;
  variant?: "full" | "compact";
}

export function ThemeToggle({ className, variant = "full" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isCompact = variant === "compact" || (className && /\bsize-\d+\b/.test(className));

  if (!mounted) {
    if (isCompact) {
      return (
        <div
          className={cn(
            "size-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse shrink-0",
            className,
          )}
        />
      );
    }
    return (
      <div
        className={cn(
          "flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border h-9 w-[108px] animate-pulse shrink-0",
          className,
        )}
      />
    );
  }

  // Single-button compact toggle (for headers, waiting halls, TV leanback)
  if (isCompact) {
    const isDark = resolvedTheme === "dark" || theme === "dark";
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs group",
          className,
        )}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDark ? (
          <Sun className="size-4 text-emerald-400 group-hover:rotate-45 transition-transform duration-200" />
        ) : (
          <Moon className="size-4 text-emerald-600 group-hover:-rotate-12 transition-transform duration-200" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border backdrop-blur-md",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
          theme === "light"
            ? "bg-background text-foreground shadow-xs text-emerald-600 dark:text-emerald-400 font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Light theme"
        title="Light theme"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
          theme === "dark"
            ? "bg-background text-foreground shadow-xs text-emerald-600 dark:text-emerald-400 font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Dark theme"
        title="Dark theme"
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
          theme === "system"
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="System theme"
        title="System theme"
      >
        <Laptop className="h-4 w-4" />
      </button>
    </div>
  );
}
