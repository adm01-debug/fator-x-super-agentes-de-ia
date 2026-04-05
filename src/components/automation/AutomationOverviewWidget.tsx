/**
 * Nexus Agents Studio — Automation Overview Widget
 *
 * Compact dashboard widget showing key metrics from
 * all automation services. For embedding in DashboardPage.
 *
 * Melhoria 7/10 — automation improvements
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Webhook, Bell, Activity, Shield, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAutomationDashboard } from '@/hooks/useAutomation';

export function AutomationOverviewWidget() {
  const { data, loading } = useAutomationDashboard(60000);
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="bg-[#111122] border-[#222244]">
        <CardContent className="p-6 text-center text-gray-400">
          <Zap size={20} className="mx-auto mb-2 animate-pulse" />
          <p className="text-sm">Carregando automações...</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      icon: Clock,
      label: 'Agendamentos',
      value: data.schedules?.active_schedules ?? 0,
      sub: `${data.schedules?.total_executions ?? 0} execuções`,
      color: '#4D96FF',
    },
    {
      icon: Activity,
      label: 'Execuções (24h)',
      value: data.executions?.total ?? 0,
      sub: `${(data.executions?.success_rate ?? 0).toFixed(0)}% sucesso`,
      color: '#6BCB77',
    },
    {
      icon: Bell,
      label: 'Notificações',
      value: data.notifications?.total_sent ?? 0,
      sub: `${(data.notifications?.delivery_rate ?? 0).toFixed(0)}% entregues`,
      color: '#9B59B6',
    },
    {
      icon: Shield,
      label: 'Credenciais',
      value: data.vault?.active ?? 0,
      sub: data.vault?.rotation_due
        ? `${data.vault.rotation_due} rotação pendente`
        : 'Tudo em dia',
      color: data.vault?.rotation_due ? '#FFD93D' : '#6BCB77',
    },
  ];

  const hasAlerts =
    (data.vault?.expiring_soon ?? 0) > 0 ||
    (data.vault?.rotation_due ?? 0) > 0 ||
    data.circuitBreakers.some((cb) => cb.state === 'open');

  return (
    <Card
      className="bg-[#111122] border-[#222244] cursor-pointer hover:border-[#4D96FF]/50 transition-colors"
      onClick={() => navigate('/automation')}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap size={16} className="text-[#FFD93D]" />
            Automation Center
          </span>
          {hasAlerts && (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">
              <AlertTriangle size={10} className="mr-1" />
              Atenção
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <m.icon size={14} style={{ color: m.color }} />
              <div>
                <p className="text-sm font-bold" style={{ color: m.color }}>
                  {m.value}
                </p>
                <p className="text-[10px] text-gray-400">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>
        {data.circuitBreakers.filter((cb) => cb.state === 'open').length > 0 && (
          <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              ⚠️ {data.circuitBreakers.filter((cb) => cb.state === 'open').length} circuit
              breaker(s) aberto(s)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
