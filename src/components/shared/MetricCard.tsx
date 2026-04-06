import { memo } from "react";
import { LucideIcon } from "lucide-react";

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

function Sparkline({ data, color = "hsl(var(--primary))", width = 64, height = 24 }: SparklineProps) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  
  // Area fill
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {data.length > 1 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
          r="2"
          fill={color}
        />
      )}
    </svg>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  sparklineData?: number[];
  sparklineColor?: string;
  className?: string;
}

export const MetricCard = memo(function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  sparklineData,
  sparklineColor,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`nexus-card nexus-metric-card group ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="mt-1.5 text-3xl font-heading font-extrabold text-foreground tracking-tight animate-number-pop">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                trend.positive 
                  ? 'bg-nexus-emerald/10 text-nexus-emerald' 
                  : 'bg-nexus-rose/10 text-nexus-rose'
              }`}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/15 group-hover:scale-110" aria-hidden="true">
            <Icon className="h-5 w-5 icon-hover-bounce" />
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <Sparkline data={sparklineData} color={sparklineColor} />
          )}
        </div>
      </div>
    </div>
  );
});
