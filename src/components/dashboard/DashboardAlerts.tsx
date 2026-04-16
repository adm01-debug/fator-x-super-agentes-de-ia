import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnresolvedAlerts, subscribeToAlerts } from '@/services/dashboardService';

export function DashboardAlerts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: alerts = [] } = useQuery({
    queryKey: ['dashboard_alerts'],
    queryFn: () => getUnresolvedAlerts(5),
    retry: 1,
  });

  useEffect(() => {
    return subscribeToAlerts(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard_alerts'] });
    });
  }, [queryClient]);

  if (alerts.length === 0) return null;

  return (
    <div className="nexus-card border-nexus-amber/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-nexus-amber animate-pulse" />
          Alertas Ativos ({alerts.length})
        </h3>
        <button onClick={() => navigate('/monitoring')} className="text-[11px] text-primary hover:underline">Ver todos</button>
      </div>
      <div className="space-y-2">
        {alerts.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-xs py-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${a.severity === 'critical' ? 'bg-destructive' : 'bg-nexus-amber'}`} />
            <span className="text-foreground truncate">{a.title}</span>
            <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">{new Date(a.created_at || '').toLocaleDateString('pt-BR')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
