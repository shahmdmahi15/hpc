import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HandlerLoading() {
  return (
    <div className="space-y-4 animate-pulse p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Banner Skeleton */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-4 w-52 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Therapy KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/80 bg-card/70 shadow-xs">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="size-6 rounded-lg" />
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-1">
              <Skeleton className="h-6 w-12 rounded" />
              <Skeleton className="h-2.5 w-24 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Floor Grid: Waiting, Active Beds/Rooms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Therapy Queue */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/80 bg-card/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-36 rounded" />
                <div className="flex items-center gap-2 pt-1">
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: Active Sessions & Modality Timers */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/80 bg-card/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
