"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border h-9 w-[108px] animate-pulse" />
    );
  }

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border backdrop-blur-md">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
          theme === "light"
            ? "bg-background text-foreground shadow-xs"
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
            ? "bg-background text-foreground shadow-xs"
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
