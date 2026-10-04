"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Phone,
  CheckCircle2,
  Shield,
} from "lucide-react";

export interface AdminPerformer {
  id: string;
  name: string;
  phone: string;
}

interface AdminPerformerSelectProps {
  adminPerformers: AdminPerformer[];
  selectedPerformerId: string;
  onSelectPerformerId: (id: string) => void;
  disabled?: boolean;
  label?: string;
  error?: string;
}

export function AdminPerformerSelect({
  adminPerformers = [],
  selectedPerformerId,
  onSelectPerformerId,
  disabled = false,
  label = "Authorizing Administrator",
  error,
}: AdminPerformerSelectProps) {
  // Always auto-select the first admin if available so underlying legacy field is populated
  React.useEffect(() => {
    if (adminPerformers.length > 0 && !selectedPerformerId) {
      onSelectPerformerId(adminPerformers[0].id);
    }
  }, [adminPerformers, selectedPerformerId, onSelectPerformerId]);

  const activeAdmin =
    adminPerformers.find((a) => a.id === selectedPerformerId) ||
    adminPerformers[0];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 text-purple-600 dark:text-purple-400" />
        {label}
      </Label>
      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-lg bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0">
            {activeAdmin ? (
              activeAdmin.name.slice(0, 2).toUpperCase()
            ) : (
              <Shield className="size-3.5" />
            )}
          </div>
          <div className="min-w-0 truncate">
            <p className="font-bold text-foreground truncate">
              {activeAdmin ? activeAdmin.name : "Authorized Administrator"}
            </p>
            <p className="text-[10.5px] font-mono text-muted-foreground flex items-center gap-1 truncate">
              {activeAdmin?.phone ? (
                <>
                  <Phone className="size-2.5" />
                  {activeAdmin.phone} • Logged In Session
                </>
              ) : (
                "Logged In • Private Admin Workspace"
              )}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10.5px] font-semibold shrink-0">
          <CheckCircle2 className="size-3" />
          Verified
        </span>
      </div>
    </div>
  );
}
