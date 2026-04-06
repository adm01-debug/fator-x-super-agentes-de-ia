/**
 * Reusable page-level skeleton loaders.
 * Use these while data is loading to maintain perceived performance.
 */

interface SkeletonBlockProps {
  className?: string;
}

function Shimmer({ className = "" }: SkeletonBlockProps) {
  return <div className={`rounded-md skeleton-shimmer ${className}`} />;
}

/** Grid of metric cards skeleton */
export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="nexus-card space-y-3" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-8 w-20" />
              <Shimmer className="h-3 w-24" />
            </div>
            <Shimmer className="h-10 w-10 rounded-xl shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** List of items skeleton */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="nexus-card space-y-3" aria-busy="true">
      <Shimmer className="h-4 w-32 mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ animationDelay: `${i * 60}ms` }}>
          <Shimmer className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-3/4" />
            <Shimmer className="h-2.5 w-1/2" />
          </div>
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="nexus-card overflow-hidden" aria-busy="true">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border/30">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className={`h-3 ${i === 0 ? 'w-32' : 'w-20'} flex-shrink-0`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/10" style={{ animationDelay: `${i * 50}ms` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Shimmer key={j} className={`h-3 ${j === 0 ? 'w-36' : j === 1 ? 'w-24' : 'w-16'} flex-shrink-0`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Full page skeleton with header + metrics + content */
export function FullPageSkeleton() {
  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto" aria-busy="true">
      {/* Page header */}
      <div className="space-y-2">
        <Shimmer className="h-4 w-48" />
        <Shimmer className="h-8 w-64" />
        <Shimmer className="h-4 w-80" />
      </div>
      {/* Metrics */}
      <MetricsSkeleton />
      {/* Content */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ListSkeleton rows={4} />
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}

/** Cards grid skeleton */
export function CardGridSkeleton({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  const colsClass = cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : cols === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid ${colsClass} gap-4`} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="nexus-card space-y-3" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex items-center gap-3">
            <Shimmer className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-4 w-2/3" />
              <Shimmer className="h-3 w-full" />
            </div>
          </div>
          <Shimmer className="h-3 w-full" />
          <div className="flex gap-2">
            <Shimmer className="h-5 w-14 rounded-full" />
            <Shimmer className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
