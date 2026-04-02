import { cn } from '@/lib/utils';

interface RadarDataPoint {
  subject: string;
  value: number;
  max: number;
}

interface Props {
  data: RadarDataPoint[];
  className?: string;
  height?: number;
  color?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function LightRadarChart({ data, className, height = 280, color }: Props) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.35;
  const levels = 4;
  const strokeColor = color || 'hsl(var(--primary))';

  const angleStep = 360 / data.length;

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const r = (maxR / levels) * (i + 1);
    const points = data.map((_, j) => {
      const p = polarToCartesian(cx, cy, r, j * angleStep);
      return `${p.x},${p.y}`;
    }).join(' ');
    return <polygon key={i} points={points} fill="none" stroke="hsl(var(--border))" strokeWidth={1} opacity={0.5} />;
  });

  // Axis lines
  const axes = data.map((_, i) => {
    const p = polarToCartesian(cx, cy, maxR, i * angleStep);
    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.3} />;
  });

  // Data polygon
  const dataPoints = data.map((d, i) => {
    const pct = d.max > 0 ? Math.min(d.value / d.max, 1) : 0;
    return polarToCartesian(cx, cy, maxR * pct, i * angleStep);
  });
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Labels
  const labels = data.map((d, i) => {
    const p = polarToCartesian(cx, cy, maxR + 18, i * angleStep);
    return (
      <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
        className="fill-muted-foreground" style={{ fontSize: 10 }}>
        {d.subject}
      </text>
    );
  });

  return (
    <div className={cn('w-full flex items-center justify-center', className)} style={{ height }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings}
        {axes}
        <polygon points={dataPath} fill={strokeColor} fillOpacity={0.15} stroke={strokeColor} strokeWidth={2} />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={strokeColor} />
        ))}
        {labels}
      </svg>
    </div>
  );
}
