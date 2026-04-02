import { useState, useMemo } from 'react';
import { useChartDimensions } from './useChartDimensions';
import { ChartTooltip } from './ChartTooltip';
import type { ChartMargin, TooltipState } from './types';

interface LineSeries {
  dataKey: string;
  name: string;
  stroke: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  dotRadius?: number;
}

interface Props {
  data: Record<string, any>[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  margin?: ChartMargin;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  showGrid?: boolean;
}

function niceMax(v: number) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function LightLineChart({
  data, xKey, series, height = 220, margin,
  yFormatter = String, tooltipFormatter, showGrid = true,
}: Props) {
  const { ref, width, margin: m, inner } = useChartDimensions(margin);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { yMax, ticks } = useMemo(() => {
    let maxVal = 0;
    for (const d of data) {
      for (const s of series) {
        const v = Number(d[s.dataKey]) || 0;
        if (v > maxVal) maxVal = v;
      }
    }
    const ym = niceMax(maxVal * 1.1);
    return { yMax: ym, ticks: [0, ym * 0.25, ym * 0.5, ym * 0.75, ym] };
  }, [data, series]);

  if (!width || inner.width <= 0 || inner.height <= 0) {
    return <div ref={ref} style={{ width: '100%', height }} />;
  }

  const scaleX = (i: number) => (i / Math.max(data.length - 1, 1)) * inner.width;
  const scaleY = (v: number) => inner.height - (v / yMax) * inner.height;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - m.left;
    const idx = Math.round((x / inner.width) * (data.length - 1));
    if (idx < 0 || idx >= data.length) { setTooltip(null); return; }
    const d = data[idx];
    setTooltip({
      x: m.left + scaleX(idx),
      y: m.top + Math.min(...series.map(s => scaleY(Number(d[s.dataKey]) || 0))) - 4,
      items: series.filter(s => d[s.dataKey] != null).map(s => ({
        label: s.name,
        value: tooltipFormatter ? tooltipFormatter(Number(d[s.dataKey]) || 0, s.name) : String(Number(d[s.dataKey]) || 0),
        color: s.stroke,
      })),
    });
  };

  return (
    <div ref={ref} style={{ width: '100%', height }} className="relative">
      <svg width={width} height={inner.height + m.top + m.bottom} className="overflow-visible">
        <g transform={`translate(${m.left},${m.top})`}>
          {showGrid && ticks.map((t, i) => (
            <g key={i}>
              <line x1={0} x2={inner.width} y1={scaleY(t)} y2={scaleY(t)} stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.5} />
              <text x={-6} y={scaleY(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
                {yFormatter(t)}
              </text>
            </g>
          ))}

          {series.map((s) => {
            const points = data.map((d, i) => ({ x: scaleX(i), y: scaleY(Number(d[s.dataKey]) || 0), v: d[s.dataKey] })).filter(p => p.v != null);
            const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
            return (
              <g key={s.dataKey}>
                <path d={path} fill="none" stroke={s.stroke} strokeWidth={s.strokeWidth ?? 2} strokeDasharray={s.strokeDasharray} />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={s.dotRadius ?? 4} fill={s.stroke} stroke="hsl(var(--card))" strokeWidth={2} />
                ))}
              </g>
            );
          })}

          <rect x={0} y={0} width={inner.width} height={inner.height} fill="transparent"
            onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />

          {data.map((d, i) => (
            <text key={i} x={scaleX(i)} y={inner.height + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
              {d[xKey]}
            </text>
          ))}
        </g>
      </svg>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
