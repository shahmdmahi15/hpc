"use client";

import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { useLiveClock } from "@/hooks/use-live-clock";
import {
  LogIn,
  Clock,
  Stethoscope,
  Users,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Radio,
  ShieldCheck,
} from "lucide-react";

interface QueueItem {
  token: string;
  room: string;
  doctor: string;
  department: string;
  status: "calling" | "in-session" | "next";
  color: string;
  patientMasked: string;
}

const ACTIVE_SESSIONS: QueueItem[] = [
  {
    token: "A-104",
    room: "Room 101",
    doctor: "Dr. Mahbubur Rahman",
    department: "Specialist Pain Consultation",
    status: "calling",
    color:
      "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
    patientMasked: "Md. K*** (Token #104)",
  },
  {
    token: "B-082",
    room: "Room 102",
    doctor: "Physiotherapy & Rehab Care",
    department: "Spine & Joint Decompression",
    status: "in-session",
    color:
      "from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/40 text-cyan-600 dark:text-cyan-400",
    patientMasked: "Fatema *** (Token #082)",
  },
  {
    token: "C-019",
    room: "Room 103",
    doctor: "Clinical Triage Specialist",
    department: "Pre-Assessment & Vitals",
    status: "next",
    color:
      "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/40 text-amber-600 dark:text-amber-400",
    patientMasked: "Tanvir *** (Token #019)",
  },
];

const UPCOMING_QUEUE = [
  { token: "A-105", dept: "Pain Care", time: "12:30 PM", status: "Waiting" },
  {
    token: "B-083",
    dept: "Physiotherapy",
    time: "12:35 PM",
    status: "Preparing",
  },
  { token: "A-106", dept: "Pain Care", time: "12:45 PM", status: "Waiting" },
  {
    token: "C-020",
    dept: "Triage",
    time: "12:45 PM",
    status: "Vitals In Progress",
  },
  {
    token: "P-216",
    dept: "Billing & Cashier",
    time: "12:50 PM",
    status: "Waiting",
  },
];

export default function WaitingRoomPage() {
  const { lang } = useI18n();
  const currentTime = useLiveClock();

  const formattedTime = currentTime
    ? currentTime.toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  const formattedDate = currentTime
    ? currentTime.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-background via-muted/20 to-background text-foreground selection:bg-primary/20">
      {/* Background Decorative Glow Meshes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 right-0 w-[420px] h-[420px] bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="w-full px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex items-center justify-between gap-4 border-b border-border/60 bg-card/60 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-4">
          <BrandLogo size="md" variant="full" />
        </div>

        {/* Live Clock, Status & Staff Login */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Clock Badge */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/80 bg-background/80 backdrop-blur-md shadow-xs">
            <Clock className="h-3.5 w-3.5 text-primary animate-spin-slow" />
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs font-bold font-mono tracking-tight text-foreground">
                {formattedTime}
              </span>
              <span className="text-[9.5px] text-muted-foreground">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">Live Queue Feed</span>
          </div>

          <FullscreenToggle className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/80 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95" />
          <LanguageSwitcher className="h-9 px-1 rounded-xl bg-card/80 border-border/80 shadow-xs backdrop-blur-md" />
          <ThemeToggle />

          <Link
            href="/login"
            title="Staff Login Portal"
            aria-label="Staff Login Portal"
            className="group flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/80 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-primary shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95"
          >
            <LogIn className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="sr-only">Staff Login</span>
          </Link>
        </div>
      </header>

      {/* Main Waiting Room Grid */}
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 flex flex-col gap-6 z-10">
        {/* Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border/50">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[11px] font-bold tracking-wide uppercase mb-1">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>Patient Queue & Token Broadcasting Board</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground">
              Waiting Area Live Status
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50 w-fit">
            <Volume2 className="h-3.5 w-3.5 text-primary" />
            <span>Audio announcements chime automatically on token call</span>
          </div>
        </div>

        {/* Section 1: Active Doctor Rooms / Calling Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {ACTIVE_SESSIONS.map((session, idx) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border bg-card/80 dark:bg-card/60 backdrop-blur-xl p-4 sm:p-6 shadow-xl transition-all duration-300 hover:shadow-2xl flex flex-col justify-between ${session.color}`}
            >
              {/* Top Room & Status Tag */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {session.room}
                  </span>
                </div>
                {session.status === "calling" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10.5px] uppercase tracking-wider animate-bounce shadow-md">
                    <Sparkles className="h-3 w-3" /> Calling
                  </span>
                ) : session.status === "in-session" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-bold text-[10.5px] uppercase">
                    In Session
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold text-[10.5px] uppercase">
                    Preparing Next
                  </span>
                )}
              </div>

              {/* Big Token Number Display */}
              <div className="my-2 py-4 px-3 rounded-2xl bg-background/80 dark:bg-background/60 border border-border/80 text-center shadow-inner">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Now Serving Token
                </span>
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground font-mono">
                  {session.token}
                </span>
                <span className="text-[11px] text-muted-foreground block mt-1 font-medium">
                  {session.patientMasked}
                </span>
              </div>

              {/* Doctor & Department Info */}
              <div className="mt-3 pt-3 border-t border-border/60">
                <p className="text-xs font-bold text-foreground truncate">
                  {session.doctor}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {session.department}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Section 2: Next In Line Queue & Clinic Notice */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Next Tokens Table */}
          <div className="lg:col-span-8 rounded-2xl sm:rounded-3xl border border-border/80 bg-card/75 dark:bg-card/50 backdrop-blur-xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  Upcoming Queue (Next in Line)
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Updated in real-time
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-[11px] text-muted-foreground">
                    <th className="py-2 px-3 font-semibold">Token No.</th>
                    <th className="py-2 px-3 font-semibold">Department</th>
                    <th className="py-2 px-3 font-semibold">Estimated Slot</th>
                    <th className="py-2 px-3 font-semibold text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {UPCOMING_QUEUE.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground text-sm">
                        {item.token}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-medium">
                        {item.dept}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">
                        {item.time}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clinic Guidelines & Protocol Card */}
          <div className="lg:col-span-4 rounded-2xl sm:rounded-3xl border border-border/80 bg-card/75 dark:bg-card/50 backdrop-blur-xl p-4 sm:p-5 shadow-lg flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-border/60 mb-3">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">
                  Patient Care Guidelines
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    Keep your token receipt and previous medical prescriptions
                    handy.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    Please proceed to the designated room immediately when your
                    token is called.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    For emergency acute pain assistance, alert the front desk
                    receptionist immediately.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground text-center">
              <p className="font-semibold text-foreground">
                Health And Pain Care Center (HPC)
              </p>
              <p>Specialized Pain Care & Rehabilitation</p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer Ticker */}
      <footer className="w-full border-t border-border/60 bg-card/80 backdrop-blur-xl px-4 py-2.5 text-xs text-muted-foreground z-10 shrink-0">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-foreground">
              Broadcast Server Synced: All Consultation Rooms Active
            </span>
          </div>
          <div className="text-[10.5px]">
            &copy; {new Date().getFullYear()} Health And Pain Care Center (HPC).
            Token & Queue Display Engine.
          </div>
        </div>
      </footer>
    </div>
  );
}
