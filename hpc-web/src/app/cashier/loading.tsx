import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CashierLoading() {
  return (
    <div className="space-y-4 animate-pulse p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner Skeleton */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Cashier Financial KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/80 bg-card/70 shadow-xs">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="size-6 rounded-lg" />
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-1">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-2.5 w-24 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Billing Queue Table/Cards Skeleton */}
      <Card className="border-border/80 bg-card/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-background/50"
            >
              <div className="space-y-1">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
