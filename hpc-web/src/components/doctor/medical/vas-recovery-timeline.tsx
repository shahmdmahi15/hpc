"use client";

import * as React from "react";
import { TrendingDown, TrendingUp, Activity } from "lucide-react";

interface VasPoint {
  id: string;
  date: string;
  vasScore: number;
  diagnosis?: string | null;
}

interface VasRecoveryTimelineProps {
  records: Array<{
    id: string;
    assessmentDate: Date | string;
    vasScore: number | null;
    diagnosis?: string | null;
  }>;
}

export function VasRecoveryTimeline({ records }: VasRecoveryTimelineProps) {
  // Sort oldest to newest
  const validPoints: VasPoint[] = records
    .filter((r) => r.vasScore !== null && r.vasScore !== undefined)
    .map((r) => ({
      id: r.id,
      date: new Date(r.assessmentDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      vasScore: r.vasScore ?? 0,
      diagnosis: r.diagnosis,
    }))
    .reverse();

  if (validPoints.length < 2) return null;

  const firstScore = validPoints[0].vasScore;
  const latestScore = validPoints[validPoints.length - 1].vasScore;
  const scoreDiff = firstScore - latestScore;
  const percentImprovement =
    firstScore > 0 ? Math.round((scoreDiff / firstScore) * 100) : 0;

  return (
    <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="size-4 text-sky-600" />
          <span className="text-xs font-bold text-foreground">
            VAS Pain Score Recovery Trajectory
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({validPoints.length} Recorded Visits)
          </span>
        </div>

        {scoreDiff > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold">
            <TrendingDown className="size-3 text-emerald-600" />
            <span>-{scoreDiff} pts ({percentImprovement}% Pain Relief)</span>
          </span>
        ) : scoreDiff === 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10.5px] font-semibold">
            <span>Stable ({latestScore}/10)</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10.5px] font-bold">
            <TrendingUp className="size-3 text-amber-600" />
            <span>+{Math.abs(scoreDiff)} pts</span>
          </span>
        )}
      </div>

      {/* Visual Step Timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
        {validPoints.map((point, index) => {
          const isLatest = index === validPoints.length - 1;
          const score = point.vasScore;
          const colorClass =
            score >= 7
              ? "text-red-600 bg-red-500/15 border-red-500/30"
              : score >= 4
                ? "text-amber-600 bg-amber-500/15 border-amber-500/30"
                : "text-emerald-600 bg-emerald-500/15 border-emerald-500/30";

          return (
            <div
              key={point.id}
              className={`p-2 rounded-lg border text-center relative ${
                isLatest
                  ? "bg-card border-primary/50 shadow-xs ring-1 ring-primary/20"
                  : "bg-background/80 border-border/70"
              }`}
            >
              <div className="flex items-center justify-between text-[9.5px] text-muted-foreground mb-1">
                <span>Visit #{index + 1}</span>
                <span>{point.date}</span>
              </div>
              <div
                className={`text-sm font-black font-mono py-0.5 rounded border ${colorClass}`}
              >
                {score}/10
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 truncate">
                {score >= 7 ? "Severe Pain" : score >= 4 ? "Moderate" : "Mild / Resolved"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
