interface Annotation {
  /** Index in data array where annotation appears */
  dataIndex: number;
  /** Label text */
  label: string;
  /** Color token */
  color?: string;
}

interface ChartAnnotationProps {
  annotations: Annotation[];
  scaleX: (i: number) => number;
  scaleY: (v: number) => number;
  data: Record<string, any>[];
  dataKey: string;
  innerHeight: number;
}

export type { Annotation };

export function ChartAnnotations({ annotations, scaleX, scaleY, data, dataKey, innerHeight }: ChartAnnotationProps) {
  return (
    <g className="chart-annotations">
      {annotations.map((ann, i) => {
        if (ann.dataIndex < 0 || ann.dataIndex >= data.length) return null;
        const x = scaleX(ann.dataIndex);
        const v = Number(data[ann.dataIndex]?.[dataKey]) || 0;
        const y = scaleY(v);
        const color = ann.color || 'hsl(var(--primary))';

        return (
          <g key={i}>
            {/* Vertical dashed line */}
            <line
              x1={x} y1={y} x2={x} y2={innerHeight}
              stroke={color} strokeDasharray="4 3" opacity={0.5} strokeWidth={1}
            />
            {/* Dot */}
            <circle cx={x} cy={y} r={4} fill={color} stroke="hsl(var(--card))" strokeWidth={2} />
            {/* Label */}
            <g transform={`translate(${x}, ${Math.max(y - 12, 8)})`}>
              <rect
                x={-2} y={-10} width={ann.label.length * 6 + 8} height={14}
                rx={3} fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5}
                transform={`translate(${-(ann.label.length * 6 + 8) / 2}, 0)`}
              />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y={-3}
                style={{ fontSize: 9, fontWeight: 500 }}
                className="fill-foreground"
              >
                {ann.label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
