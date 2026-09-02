"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard, Sparkles } from "lucide-react";
import { ROLES } from "@/components/login/role-config";

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl w-full bg-card/95 dark:bg-card/90 backdrop-blur-2xl border-border/80 shadow-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-7 gap-5 overflow-hidden">
        {/* Header */}
        <DialogHeader className="space-y-1.5 text-left border-b border-border/60 pb-3.5 pr-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-2 ring-primary/5">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Keyboard Shortcuts & Power-User Controls</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  <Sparkles className="h-2.5 w-2.5" /> Fast Mode
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Navigate the clinical portal at maximum speed without touching
                your mouse
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 2-Column Responsive Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs">
          {/* Column 1: Quick Role Selection (1-5) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Quick Department Selection
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-mono">
                Keys (1 – 5)
              </span>
            </div>

            <div className="space-y-1.5">
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <div
                    key={role.value}
                    className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-border/60 bg-background/50 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${role.color}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {role.defaultLabel}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {role.defaultDesc}
                        </p>
                      </div>
                    </div>
                    <kbd className="shrink-0 px-2.5 py-1 rounded-lg border border-border/80 bg-muted text-[11px] font-mono font-bold text-foreground shadow-xs">
                      {role.shortcut}
                    </kbd>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: System Navigation & Portal Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Portal Navigation & Controls
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-mono">
                System Hotkeys
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-border/60 bg-background/50">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Focus Password Field
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Instantly jumps focus to password input
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 rounded-lg border border-border/80 bg-muted text-[11px] font-mono font-bold text-foreground shadow-xs">
                    /
                  </kbd>
                  <span className="text-[10px] text-muted-foreground">or</span>
                  <kbd className="px-2 py-1 rounded-lg border border-border/80 bg-muted text-[11px] font-mono font-bold text-foreground shadow-xs">
                    P
                  </kbd>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-border/60 bg-background/50">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Waiting Room Queue
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Opens live patient queue display
                  </p>
                </div>
                <kbd className="px-2.5 py-1 rounded-lg border border-border/80 bg-muted text-[11px] font-mono font-bold text-foreground shadow-xs">
                  W
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-border/60 bg-background/50">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Toggle Fullscreen Mode
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Expands kiosk or counter screen
                  </p>
                </div>
                <kbd className="px-2.5 py-1 rounded-lg border border-border/80 bg-muted text-[11px] font-mono font-bold text-foreground shadow-xs">
                  F
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-border/60 bg-background/50">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Show / Hide Shortcuts
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Toggles this cheat sheet popup
                  </p>
                </div>
                <kbd className="px-2.5 py-1 rounded-lg border border-border/80 bg-muted text-[11px] font-mono font-bold text-foreground shadow-xs">
                  ?
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-border/60 bg-background/50">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Submit Authentication
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Trigger login with active credentials
                  </p>
                </div>
                <kbd className="px-2 py-1 rounded-lg border border-border/80 bg-muted text-[10px] font-mono font-bold text-foreground shadow-xs">
                  Enter
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono font-bold">
              Esc
            </kbd>
            <span>or click outside to close</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 text-xs font-semibold cursor-pointer"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
