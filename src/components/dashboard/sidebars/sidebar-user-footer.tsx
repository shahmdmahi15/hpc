"use client";

import * as React from "react";
import { SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logoutAction } from "@/actions/login/login.action";
import { LogOut } from "lucide-react";
import { Role } from "@/generated/prisma/enums";

interface SidebarUserFooterProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function SidebarUserFooter({ user }: SidebarUserFooterProps) {
  const { state } = useSidebar();

  const roleColors: Record<Role, string> = {
    [Role.ADMIN]: "bg-red-500/10 text-red-500 border-red-500/20",
    [Role.DOCTOR]: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    [Role.RECEPTIONIST]:
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    [Role.HANDLER]: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  return (
    <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-1.5">
      <div
        className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
          state === "collapsed"
            ? "justify-center p-0 border-transparent bg-transparent"
            : "border-border/60 bg-muted/40"
        }`}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="text-[11px] font-bold">
            {user.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {state === "expanded" && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {user.name}
            </p>
            <span
              className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${roleColors[user.role]}`}
            >
              {user.role}
            </span>
          </div>
        )}

        <form
          action={logoutAction}
          suppressHydrationWarning
          className={state === "collapsed" ? "hidden" : "shrink-0"}
        >
          <button
            type="submit"
            title="Sign Out"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </SidebarFooter>
  );
}
