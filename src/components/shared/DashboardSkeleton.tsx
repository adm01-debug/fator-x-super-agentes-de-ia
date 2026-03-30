import { Skeleton } from "@/components/ui/skeleton";

export function MetricCardSkeleton() {
  return (
    <div className="nexus-card animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24 bg-muted/50" />
          <Skeleton className="h-7 w-16 bg-muted/50" />
          <Skeleton className="h-3 w-20 bg-muted/50" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <div className="nexus-card animate-pulse">
      <Skeleton className="h-4 w-36 bg-muted/50 mb-4" />
      <div className="space-y-3">
        <div className="flex items-end gap-2 h-[200px] pt-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 bg-muted/30 rounded-t"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="nexus-card animate-pulse">
      <Skeleton className="h-4 w-32 bg-muted/50 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg bg-muted/50 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4 bg-muted/50" />
              <Skeleton className="h-2.5 w-1/2 bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto" aria-busy="true" aria-label="Carregando dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 bg-muted/50" />
          <Skeleton className="h-4 w-64 bg-muted/30" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg bg-muted/50" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartCardSkeleton key={i} />
        ))}
      </div>

      {/* Bottom lists */}
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ListCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
