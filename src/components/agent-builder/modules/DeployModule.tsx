import { fromTable } from '@/lib/supabaseExtended';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField } from '../ui';
import { Globe, MessageSquare, Mail, Hash, Send, Radio, Sparkles } from 'lucide-react';

import { getWorkspaceId } from '@/lib/agentService';
import type { DeployChannelConfig, MonitoringKPI, DeployChannel } from '@/types/agentTypes';

const ENVIRONMENT_OPTIONS = [
  {
    value: 'cloud_api',
    label: '☁️ Cloud API',
    description: 'API gerenciada na nuvem com auto-scaling.',
  },
  {
    value: 'self_hosted',
    label: '🏠 Self-Hosted',
    description: 'Deploy em infraestrutura própria.',
  },
  { value: 'hybrid', label: '🔄 Híbrido', description: 'Combinação de cloud e on-premises.' },
];

const CHANNEL_META: Record<DeployChannel, { icon: React.ReactNode; label: string }> = {
  api: { icon: <Globe className="h-4 w-4" />, label: 'REST API' },
  whatsapp: { icon: <MessageSquare className="h-4 w-4" />, label: 'WhatsApp' },
  web_chat: { icon: <MessageSquare className="h-4 w-4" />, label: 'Web Chat' },
  slack: { icon: <Hash className="h-4 w-4" />, label: 'Slack' },
  email: { icon: <Mail className="h-4 w-4" />, label: 'Email' },
  bitrix24: { icon: <Radio className="h-4 w-4" />, label: 'Bitrix24' },
  telegram: { icon: <Send className="h-4 w-4" />, label: 'Telegram' },
  discord: { icon: <Hash className="h-4 w-4" />, label: 'Discord' },
  huggingface_space: { icon: <Sparkles className="h-4 w-4" />, label: 'HF Space' },
};

const DEFAULT_CHANNELS: DeployChannelConfig[] = [
  {
    id: 'ch-api',
    channel: 'api',
    enabled: true,
    config: { endpoint: '/v1/chat' },
    status: 'active',
  },
  {
    id: 'ch-web',
    channel: 'web_chat',
    enabled: false,
    config: { widget_color: '#3B82F6' },
    status: 'inactive',
  },
  {
    id: 'ch-whatsapp',
    channel: 'whatsapp',
    enabled: false,
    config: { phone: '' },
    status: 'inactive',
  },
  {
    id: 'ch-slack',
    channel: 'slack',
    enabled: false,
    config: { workspace: '' },
    status: 'inactive',
  },
  {
    id: 'ch-telegram',
    channel: 'telegram',
    enabled: false,
    config: { bot_token: '' },
    status: 'inactive',
  },
  { id: 'ch-email', channel: 'email', enabled: false, config: { address: '' }, status: 'inactive' },
  {
    id: 'ch-discord',
    channel: 'discord',
    enabled: false,
    config: { server_id: '' },
    status: 'inactive',
  },
  {
    id: 'ch-bitrix',
    channel: 'bitrix24',
    enabled: false,
    config: { webhook_url: '' },
    status: 'inactive',
  },
  {
    id: 'ch-hfspace',
    channel: 'huggingface_space',
    enabled: false,
    config: { repo_id: '', visibility: 'public' },
    status: 'inactive',
  },
];

const DEFAULT_KPIS: MonitoringKPI[] = [
  { id: 'kpi-latency', name: 'Latência P95', target: '< 3s', icon: '⏱️', enabled: true },
  { id: 'kpi-success', name: 'Taxa de Sucesso', target: '> 95%', icon: '✅', enabled: true },
  {
    id: 'kpi-satisfaction',
    name: 'Satisfação do Usuário',
    target: '> 4.0/5',
    icon: '⭐',
    enabled: true,
  },
  { id: 'kpi-cost', name: 'Custo por Interação', target: '< $0.05', icon: '💰', enabled: false },
  {
    id: 'kpi-hallucination',
    name: 'Taxa de Alucinação',
    target: '< 5%',
    icon: '🎭',
    enabled: true,
  },
  { id: 'kpi-uptime', name: 'Uptime', target: '99.9%', icon: '🟢', enabled: true },
];

export function DeployModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const channels = agent.deploy_channels.length > 0 ? agent.deploy_channels : DEFAULT_CHANNELS;
  const kpis = agent.monitoring_kpis.length > 0 ? agent.monitoring_kpis : DEFAULT_KPIS;

  const updateChannel = (id: string, partial: Partial<DeployChannelConfig>) => {
    const updated = channels.map((c) => (c.id === id ? { ...c, ...partial } : c));
    updateAgent({ deploy_channels: updated });
    // Sync to deploy_connections table (non-blocking)
    if (agent.id) {
      const ch = updated.find((c) => c.id === id);
      if (ch) {
        getWorkspaceId()
          .then((wsId) => {
            void fromTable('deploy_connections').upsert({
              agent_id: agent.id,
              workspace_id: wsId,
              channel: ch.channel,
              status: ch.enabled ? 'active' : 'inactive',
              config: ch.config,
            });
          })
          .catch(() => {
            /* deploy_connections sync is best-effort */
          });
      }
    }
  };

  const updateKPI = (id: string, partial: Partial<MonitoringKPI>) => {
    const updated = kpis.map((k) => (k.id === id ? { ...k, ...partial } : k));
    updateAgent({ monitoring_kpis: updated });
  };

  const activeChannels = channels.filter((c) => c.enabled).length;
  const activeKPIs = kpis.filter((k) => k.enabled).length;

  return (
    <div className="space-y-10">
      {/* Ambiente */}
      <section>
        <SectionTitle
          icon="🚀"
          title="Deploy & Canais"
          subtitle="Configure o ambiente de deploy, canais de comunicação e KPIs de monitoramento."
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {ENVIRONMENT_OPTIONS.map((env) => (
            <button
              key={env.value}
              onClick={() =>
                updateAgent({ deploy_environment: env.value as typeof agent.deploy_environment })
              }
              className={`rounded-xl border p-4 text-left transition-all ${
                agent.deploy_environment === env.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <p className="text-sm font-medium text-foreground">{env.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{env.description}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ToggleField
            label="Auto Scaling"
            checked={agent.auto_scaling}
            onCheckedChange={(v) => updateAgent({ auto_scaling: v })}
          />
          <ToggleField
            label="Logging Habilitado"
            checked={agent.logging_enabled}
            onCheckedChange={(v) => updateAgent({ logging_enabled: v })}
          />
        </div>
      </section>

      {/* Canais */}
      <section>
        <SectionTitle
          icon="📡"
          title="Canais de Deploy"
          subtitle="Ative os canais onde o agente estará disponível."
          badge={
            <NexusBadge color="blue">
              {activeChannels}/{channels.length} ativos
            </NexusBadge>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {channels.map((ch) => {
            const meta = CHANNEL_META[ch.channel];
            return (
              <div
                key={ch.id}
                className={`rounded-xl border p-4 transition-all ${
                  ch.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{meta.icon}</span>
                    <span className="text-sm font-medium text-foreground">{meta.label}</span>
                  </div>
                  <ToggleField
                    label=""
                    checked={ch.enabled}
                    onCheckedChange={(v) =>
                      updateChannel(ch.id, { enabled: v, status: v ? 'active' : 'inactive' })
                    }
                  />
                </div>
                {ch.enabled && (
                  <div className="space-y-2">
                    {Object.entries(ch.config).map(([key, value]) => (
                      <div key={key}>
                        <label className="text-[11px] text-muted-foreground uppercase">
                          {key.replace(/_/g, ' ')}
                        </label>
                        <input
                          aria-label={`${meta.label} — ${key.replace(/_/g, ' ')}`}
                          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground"
                          value={value}
                          onChange={(e) =>
                            updateChannel(ch.id, {
                              config: { ...ch.config, [key]: e.target.value },
                            })
                          }
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${ch.status === 'active' ? 'bg-nexus-emerald' : ch.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'}`}
                      />
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {ch.status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* KPIs */}
      <section>
        <SectionTitle
          icon="📈"
          title="KPIs de Monitoramento"
          subtitle="Defina os indicadores que serão acompanhados em produção."
          badge={
            <NexusBadge color="green">
              {activeKPIs}/{kpis.length} ativos
            </NexusBadge>
          }
        />
        <div className="space-y-2">
          {kpis.map((kpi) => (
            <div
              key={kpi.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                kpi.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <ToggleField
                  label=""
                  checked={kpi.enabled}
                  onCheckedChange={(v) => updateKPI(kpi.id, { enabled: v })}
                />
                <span className="text-lg">{kpi.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{kpi.name}</p>
                  <p className="text-[11px] text-muted-foreground">Target: {kpi.target}</p>
                </div>
              </div>
              {kpi.enabled && (
                <input
                  aria-label={`Meta KPI ${kpi.name}`}
                  className="w-24 rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs text-foreground text-right"
                  value={kpi.target}
                  onChange={(e) => updateKPI(kpi.id, { target: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section>
        <SectionTitle
          icon="💸"
          title="Orçamento & Alertas"
          subtitle="Controle de custos e alertas de budget."
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="deploy-budget" className="text-xs text-muted-foreground mb-1 block">
              Budget Mensal (USD)
            </label>
            <input
              id="deploy-budget"
              type="number"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
              value={agent.monthly_budget ?? ''}
              onChange={(e) =>
                updateAgent({ monthly_budget: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Ex: 500"
            />
          </div>
          <div>
            <label htmlFor="deploy-alert-pct" className="text-xs text-muted-foreground mb-1 block">
              Alerta em (%)
            </label>
            <input
              id="deploy-alert-pct"
              type="number"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
              value={agent.budget_alert_threshold}
              onChange={(e) => updateAgent({ budget_alert_threshold: Number(e.target.value) })}
              min={0}
              max={100}
            />
          </div>
          <div className="flex items-end">
            <ToggleField
              label="Kill Switch (parar ao atingir budget)"
              checked={agent.budget_kill_switch}
              onCheckedChange={(v) => updateAgent({ budget_kill_switch: v })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
