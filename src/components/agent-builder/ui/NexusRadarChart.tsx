import { Radar, RadarChart as ReRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface RadarDataPoint {
  subject: string;
  value: number;
  max: number;
}

interface NexusRadarChartProps {
  data: RadarDataPoint[];
  className?: string;
}

export function NexusRadarChart({ data, className }: NexusRadarChartProps) {
  const chartData = data.map((d) => ({
    subject: d.subject,
    value: d.max > 0 ? (d.value / d.max) * 100 : 0,
    fullMark: 100,
  }));

  return (
    <div className={cn('w-full', className)} style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReRadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
