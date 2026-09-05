import * as React from "react";
import { Role } from "@/generated/prisma/enums";
import {
  ShieldAlert,
  Stethoscope,
  Headphones,
  UserCheck,
  Banknote,
} from "lucide-react";

export interface RoleConfig {
  value: Role;
  shortcut: string;
  labelKey: string;
  descKey: string;
  defaultLabel: string;
  defaultDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeColor: string;
  selectedBg: string;
  selectedBorder: string;
  selectedRing: string;
  accentText: string;
  glowTop: string;
  glowRight: string;
  glowBottom: string;
  cardGlow: string;
  btnGradient: string;
  fullWidthOnSmallGrid?: boolean;
}

export const ROLES: RoleConfig[] = [
  {
    value: Role.ADMIN,
    shortcut: "1",
    labelKey: "role.admin",
    descKey: "role.admin_desc",
    defaultLabel: "Administrator",
    defaultDesc: "System operations, audit logs, and security controls",
    icon: ShieldAlert,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    badgeColor:
      "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    selectedBg: "bg-rose-500/10 dark:bg-rose-500/15",
    selectedBorder: "border-rose-500/80 dark:border-rose-500/70",
    selectedRing: "ring-rose-500/25",
    accentText: "text-rose-600 dark:text-rose-400",
    glowTop: "bg-rose-500/20 dark:bg-rose-500/15",
    glowRight: "bg-red-500/15 dark:bg-red-500/10",
    glowBottom: "bg-rose-600/15 dark:bg-rose-600/10",
    cardGlow: "shadow-rose-500/10 border-rose-500/30",
    btnGradient:
      "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/25 shadow-lg",
    fullWidthOnSmallGrid: true,
  },
  {
    value: Role.DOCTOR,
    shortcut: "2",
    labelKey: "role.doctor",
    descKey: "role.doctor_desc",
    defaultLabel: "Doctor",
    defaultDesc: "Clinical cases, diagnostic plans, and doctor portal",
    icon: Stethoscope,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    badgeColor:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    selectedBg: "bg-cyan-500/10 dark:bg-cyan-500/15",
    selectedBorder: "border-cyan-500/80 dark:border-cyan-500/70",
    selectedRing: "ring-cyan-500/25",
    accentText: "text-cyan-600 dark:text-cyan-400",
    glowTop: "bg-cyan-500/20 dark:bg-cyan-500/15",
    glowRight: "bg-teal-500/15 dark:bg-teal-500/10",
    glowBottom: "bg-blue-600/15 dark:bg-blue-600/10",
    cardGlow: "shadow-cyan-500/10 border-cyan-500/30",
    btnGradient:
      "bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 hover:from-cyan-500 hover:to-teal-500 text-white shadow-cyan-500/25 shadow-lg",
  },
  {
    value: Role.RECEPTIONIST,
    shortcut: "3",
    labelKey: "role.receptionist",
    descKey: "role.receptionist_desc",
    defaultLabel: "Receptionist",
    defaultDesc: "Intake, client coordination, and scheduling",
    icon: Headphones,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    badgeColor:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    selectedBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    selectedBorder: "border-emerald-500/80 dark:border-emerald-500/70",
    selectedRing: "ring-emerald-500/25",
    accentText: "text-emerald-600 dark:text-emerald-400",
    glowTop: "bg-emerald-500/20 dark:bg-emerald-500/15",
    glowRight: "bg-teal-500/15 dark:bg-teal-500/10",
    glowBottom: "bg-emerald-600/15 dark:bg-emerald-600/10",
    cardGlow: "shadow-emerald-500/10 border-emerald-500/30",
    btnGradient:
      "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 shadow-lg",
  },
  {
    value: Role.HANDLER,
    shortcut: "4",
    labelKey: "role.handler",
    descKey: "role.handler_desc",
    defaultLabel: "Handler",
    defaultDesc: "Execution support, care logistics, and triage",
    icon: UserCheck,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    badgeColor:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    selectedBg: "bg-amber-500/10 dark:bg-amber-500/15",
    selectedBorder: "border-amber-500/80 dark:border-amber-500/70",
    selectedRing: "ring-amber-500/25",
    accentText: "text-amber-600 dark:text-amber-400",
    glowTop: "bg-amber-500/20 dark:bg-amber-500/15",
    glowRight: "bg-orange-500/15 dark:bg-orange-500/10",
    glowBottom: "bg-amber-600/15 dark:bg-amber-600/10",
    cardGlow: "shadow-amber-500/10 border-amber-500/30",
    btnGradient:
      "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/25 shadow-lg",
  },
  {
    value: Role.CASHIER,
    shortcut: "5",
    labelKey: "role.cashier",
    descKey: "role.cashier_desc",
    defaultLabel: "Cashier",
    defaultDesc: "Payment receipts, billing registers, and accounts",
    icon: Banknote,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    badgeColor:
      "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    selectedBg: "bg-purple-500/10 dark:bg-purple-500/15",
    selectedBorder: "border-purple-500/80 dark:border-purple-500/70",
    selectedRing: "ring-purple-500/25",
    accentText: "text-purple-600 dark:text-purple-400",
    glowTop: "bg-purple-500/20 dark:bg-purple-500/15",
    glowRight: "bg-fuchsia-500/15 dark:bg-fuchsia-500/10",
    glowBottom: "bg-purple-600/15 dark:bg-purple-600/10",
    cardGlow: "shadow-purple-500/10 border-purple-500/30",
    btnGradient:
      "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25 shadow-lg",
  },
];
