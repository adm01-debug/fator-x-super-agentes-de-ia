import { LightRadarChart } from '@/components/charts';

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
  return <LightRadarChart data={data} className={className} height={280} />;
}
