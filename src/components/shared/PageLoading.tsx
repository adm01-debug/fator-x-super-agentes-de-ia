import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "react-router-dom";

const PAGE_SKELETONS: Record<string, () => React.ReactNode> = {
  '/': DashboardPageSkeleton,
  '/agents': AgentsPageSkeleton,
  '/brain': GenericListSkeleton,
  '/oracle': GenericFormSkeleton,
  '/knowledge': GenericListSkeleton,
  '/prompts': GenericListSkeleton,
  '/workflows': GenericListSkeleton,
  '/monitoring': DashboardPageSkeleton,
  '/evaluations': GenericListSkeleton,
  '/settings': GenericFormSkeleton,
};

export function PageLoading() {
  const location = useLocation();
  const path = location.pathname;
  
  // Find matching skeleton
  const SkeletonComponent = PAGE_SKELETONS[path] || 
    Object.entries(PAGE_SKELETONS).find(([route]) => path.startsWith(route + '/'))?.[1] ||
    DefaultSkeleton;

  return (
    <div className="flex-1 min-h-[60vh]" role="status" aria-label="Carregando página" aria-live="polite">
      <SkeletonComponent />
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto animate-in fade-in duration-300">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 shimmer" />
        <Skeleton className="h-4 w-72 shimmer" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricSkeleton key={i} delay={i * 75} />
        ))}
      </div>
      <div className="nexus-card p-0 overflow-hidden">
        <Skeleton className="h-10 w-full shimmer" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-border/30" style={{ animationDelay: `${i * 50}ms` }}>
            <Skeleton className="h-8 w-8 rounded-lg shimmer" />
            <Skeleton className="h-3 flex-1 shimmer" />
            <Skeleton className="h-6 w-16 rounded-full shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPageSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 shimmer" />
          <Skeleton className="h-4 w-64 shimmer" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg shimmer" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricSkeleton key={i} delay={i * 60} />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} delay={i * 80} />
        ))}
      </div>
    </div>
  );
}

function AgentsPageSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 shimmer" />
          <Skeleton className="h-4 w-56 shimmer" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg shimmer" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shimmer" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <AgentCardSkeleton key={i} delay={i * 70} />
        ))}
      </div>
    </div>
  );
}

function GenericListSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto animate-in fade-in duration-300">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 shimmer" />
        <Skeleton className="h-4 w-72 shimmer" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="nexus-card space-y-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shimmer" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4 shimmer" />
                <Skeleton className="h-3 w-1/2 shimmer" />
              </div>
            </div>
            <Skeleton className="h-3 w-full shimmer" />
            <Skeleton className="h-3 w-2/3 shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericFormSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[800px] mx-auto animate-in fade-in duration-300">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36 shimmer" />
        <Skeleton className="h-4 w-64 shimmer" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="nexus-card space-y-4" style={{ animationDelay: `${i * 80}ms` }}>
          <Skeleton className="h-5 w-32 shimmer" />
          <Skeleton className="h-10 w-full rounded-lg shimmer" />
          <Skeleton className="h-10 w-full rounded-lg shimmer" />
        </div>
      ))}
    </div>
  );
}

// Reusable skeleton atoms
function MetricSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="nexus-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24 shimmer" />
          <Skeleton className="h-7 w-16 shimmer" />
          <Skeleton className="h-3 w-20 shimmer" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl shimmer" />
      </div>
    </div>
  );
}

function ChartSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="nexus-card" style={{ animationDelay: `${delay}ms` }}>
      <Skeleton className="h-4 w-36 shimmer mb-4" />
      <div className="flex items-end gap-2 h-[180px] pt-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t shimmer"
            style={{ height: `${25 + Math.sin(i * 0.8) * 30 + 30}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="nexus-card space-y-3" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl shimmer" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3 shimmer" />
          <Skeleton className="h-3 w-1/3 shimmer" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full shimmer" />
      </div>
      <Skeleton className="h-3 w-full shimmer" />
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-14 rounded-full shimmer" />
        ))}
      </div>
    </div>
  );
}
