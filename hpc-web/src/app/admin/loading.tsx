import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 1. Welcome & Status Banner Skeleton */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2.5 max-w-xl w-full">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-8 w-72 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-md rounded" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-40 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. Top 4 Operational KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/80 bg-card/70 shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="size-8 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-28 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. System Infrastructure & Telemetry Skeleton (6 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/80 bg-card/70 shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="size-8 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Skeleton className="h-7 w-16 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 4. Portal Navigation Cards Skeleton */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-3.5 w-72 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/80 bg-card p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
              <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Recent Security & Audit Events Stream Skeleton */}
      <Card className="border-border/80 bg-card/70 shadow-xs">
        <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          </div>
          <Skeleton className="h-4 w-24 rounded" />
        </CardHeader>
        <CardContent className="pt-3 divide-y divide-border/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Skeleton className="size-2 rounded-full shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-36 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
