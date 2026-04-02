import { useState, useMemo } from 'react';
import { useChartDimensions } from './useChartDimensions';
import { ChartTooltip } from './ChartTooltip';
import type { TooltipState } from './types';

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: PieSlice[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${large} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

export function LightPieChart({ data, height = 180, innerRadius = 40, outerRadius = 70, showLabels = true }: Props) {
  const { ref, width } = useChartDimensions({ top: 0, right: 0, bottom: 0, left: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  if (!width || !height) return <div ref={ref} style={{ width: '100%', height }} />;

  const cx = width / 2;
  const cy = height / 2;
  let currentAngle = 0;

  return (
    <div ref={ref} style={{ width: '100%', height }} className="relative">
      <svg width={width} height={height}>
        {data.map((slice) => {
          const angle = total > 0 ? (slice.value / total) * 360 : 0;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;

          const midAngle = (startAngle + endAngle) / 2;
          const labelR = outerRadius + 16;
          const labelPos = polarToCartesian(cx, cy, labelR, midAngle);
          const pct = total > 0 ? ((slice.value / total) * 100).toFixed(0) : '0';

          return (
            <g key={slice.name}>
              <path
                d={sectorPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle)}
                fill={slice.color}
                className="transition-opacity hover:opacity-80 cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = ref.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    items: [{ label: slice.name, value: `${slice.value} (${pct}%)`, color: slice.color }],
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {showLabels && angle > 15 && (
                <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
                  className="fill-muted-foreground" style={{ fontSize: 9 }}>
                  {slice.name} {pct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
