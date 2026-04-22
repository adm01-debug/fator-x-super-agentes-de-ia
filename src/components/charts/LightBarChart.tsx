import { useState, useMemo } from 'react';
import { useChartDimensions } from './useChartDimensions';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';
import type { ChartMargin, TooltipState } from './types';

interface BarSeries {
  dataKey: string;
  name: string;
  color: string;
  stackId?: string;
  radius?: number;
}

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  margin?: ChartMargin;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  showLegend?: boolean;
  showGrid?: boolean;
  /** Optional click handler on a bar/group. Receives the datum and its index. */
  onBarClick?: (datum: Record<string, unknown>, index: number) => void;
}

function niceMax(v: number) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function LightBarChart({
  data,
  xKey,
  series,
  height = 220,
  margin,
  yFormatter = String,
  tooltipFormatter,
  showLegend = false,
  showGrid = true,
  onBarClick,
}: Props) {
  const { ref, width, margin: m, inner } = useChartDimensions(margin);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { yMax, ticks, isStacked } = useMemo(() => {
    const stacked = series.some((s) => s.stackId);
    let maxVal = 0;

    if (stacked) {
      const groups = new Map<string, BarSeries[]>();
      for (const s of series) {
        const id = s.stackId || s.dataKey;
        groups.set(id, [...(groups.get(id) || []), s]);
      }
      for (const d of data) {
        for (const [, group] of groups) {
          const sum = group.reduce((s, g) => s + (Number(d[g.dataKey]) || 0), 0);
          if (sum > maxVal) maxVal = sum;
        }
      }
      const ym = niceMax(maxVal * 1.1);
      return { yMax: ym, ticks: [0, ym * 0.25, ym * 0.5, ym * 0.75, ym], isStacked: true };
    } else {
      for (const d of data) {
        for (const s of series) {
          const v = Number(d[s.dataKey]) || 0;
          if (v > maxVal) maxVal = v;
        }
      }
      const ym = niceMax(maxVal * 1.1);
      return { yMax: ym, ticks: [0, ym * 0.25, ym * 0.5, ym * 0.75, ym], isStacked: false };
    }
  }, [data, series]);

  if (!width || inner.width <= 0 || inner.height <= 0) {
    return <div ref={ref} style={{ width: '100%', height }} />;
  }

  const barGroupWidth = inner.width / data.length;
  const barPad = Math.max(barGroupWidth * 0.2, 2);
  const barCount = isStacked ? 1 : series.length;
  const barW = Math.min((barGroupWidth - barPad * 2) / barCount, 24);

  const scaleY = (v: number) => inner.height - (v / yMax) * inner.height;

  // Only show ~5 x-axis labels
  const labelInterval = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div ref={ref} style={{ width: '100%', height }} className="relative">
      <svg width={width} height={inner.height + m.top + m.bottom} className="overflow-visible">
        <g transform={`translate(${m.left},${m.top})`}>
          {/* Grid + Y axis */}
          {showGrid &&
            ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={0}
                  x2={inner.width}
                  y1={scaleY(t)}
                  y2={scaleY(t)}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <text
                  x={-6}
                  y={scaleY(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10 }}
                >
                  {yFormatter(t)}
                </text>
              </g>
            ))}

          {/* Bars */}
          {data.map((d, di) => {
            const groupX = di * barGroupWidth + barPad;

            if (isStacked) {
              let accumulated = 0;
              const bars: JSX.Element[] = [];
              for (const s of series) {
                const v = Number(d[s.dataKey]) || 0;
                const y = scaleY(accumulated + v);
                const h = scaleY(accumulated) - y;
                const r = s.radius ?? 3;
                bars.push(
                  <rect
                    key={s.dataKey}
                    x={groupX + (barGroupWidth - barPad * 2 - barW) / 2}
                    y={y}
                    width={barW}
                    height={Math.max(0, h)}
                    fill={s.color}
                    rx={bars.length === series.length - 1 ? r : 0}
                  />,
                );
                accumulated += v;
              }
              return (
                <g
                  key={di}
                  className={onBarClick ? 'cursor-pointer' : undefined}
                  role={onBarClick ? 'button' : undefined}
                  tabIndex={onBarClick ? 0 : undefined}
                  onClick={onBarClick ? () => onBarClick(d, di) : undefined}
                  onKeyDown={
                    onBarClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onBarClick(d, di);
                          }
                        }
                      : undefined
                  }
                  onMouseEnter={() => {
                    const rect = ref.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTooltip({
                      x: m.left + groupX + (barGroupWidth - barPad * 2) / 2,
                      y: m.top + scaleY(accumulated) - 4,
                      items: series.map((s) => ({
                        label: s.name,
                        value: tooltipFormatter
                          ? tooltipFormatter(Number(d[s.dataKey]) || 0, s.name)
                          : String(Number(d[s.dataKey]) || 0),
                        color: s.color,
                      })),
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {bars}
                </g>
              );
            }

            return (
              <g key={di}>
                {series.map((s, si) => {
                  const v = Number(d[s.dataKey]) || 0;
                  const x = groupX + si * barW + (barGroupWidth - barPad * 2 - barW * barCount) / 2;
                  const barH = (v / yMax) * inner.height;
                  const r = s.radius ?? 3;
                  return (
                    <rect
                      key={s.dataKey}
                      x={x}
                      y={scaleY(v)}
                      width={barW}
                      height={Math.max(0, barH)}
                      fill={s.color}
                      rx={r}
                      className={`transition-opacity hover:opacity-80 ${onBarClick ? 'cursor-pointer' : ''}`}
                      role={onBarClick ? 'button' : undefined}
                      tabIndex={onBarClick ? 0 : undefined}
                      onClick={onBarClick ? () => onBarClick(d, di) : undefined}
                      onKeyDown={
                        onBarClick
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onBarClick(d, di);
                              }
                            }
                          : undefined
                      }
                      onMouseEnter={() => {
                        setTooltip({
                          x: m.left + x + barW / 2,
                          y: m.top + scaleY(v) - 4,
                          items: [
                            {
                              label: s.name,
                              value: tooltipFormatter ? tooltipFormatter(v, s.name) : String(v),
                              color: s.color,
                            },
                          ],
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X axis labels */}
          {data.map((d, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={i}
                x={i * barGroupWidth + barGroupWidth / 2}
                y={inner.height + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {d[xKey]}
              </text>
            );
          })}
        </g>
      </svg>
      <ChartTooltip tooltip={tooltip} />
      {showLegend && <ChartLegend items={series.map((s) => ({ label: s.name, color: s.color }))} />}
    </div>
  );
}
