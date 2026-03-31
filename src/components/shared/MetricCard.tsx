import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, className = "" }: MetricCardProps) {
  return (
    <div
      className={`nexus-card group ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl font-heading font-bold text-foreground tracking-tight">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-nexus-emerald' : 'text-nexus-rose'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}
