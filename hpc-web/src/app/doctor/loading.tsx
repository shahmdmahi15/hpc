import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DoctorLoading() {
  return (
    <div className="space-y-4 animate-pulse p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner Skeleton */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
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

      {/* Main Queue & Consultation Workspace Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Waiting Queue */}
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
                  <Skeleton className="h-4 w-12 rounded-full" />
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

        {/* Right Column: Active Consultation Room */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Card className="border-border/80 bg-card/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-4/6 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
