import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SelectField, SliderField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as openClaw from '@/services/openClawService';
import { Plus, Trash2, Globe, MessageSquare, Mail, Hash, Send, Radio } from 'lucide-react';
import type { DeployChannelConfig, MonitoringKPI, DeployChannel } from '@/types/agentTypes';

const ENVIRONMENT_OPTIONS = [
  { value: 'cloud_api', label: '☁️ Cloud API', description: 'API gerenciada na nuvem com auto-scaling.' },
  { value: 'self_hosted', label: '🏠 Self-Hosted', description: 'Deploy em infraestrutura própria.' },
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
  openclaw: { icon: <Globe className="h-4 w-4" />, label: 'OpenClaw' },
};

const DEFAULT_CHANNELS: DeployChannelConfig[] = [
  { id: 'ch-api', channel: 'api', enabled: true, config: { endpoint: '/v1/chat' }, status: 'active' },
  { id: 'ch-web', channel: 'web_chat', enabled: false, config: { widget_color: '#3B82F6' }, status: 'inactive' },
  { id: 'ch-whatsapp', channel: 'whatsapp', enabled: false, config: { phone: '' }, status: 'inactive' },
  { id: 'ch-slack', channel: 'slack', enabled: false, config: { workspace: '' }, status: 'inactive' },
  { id: 'ch-telegram', channel: 'telegram', enabled: false, config: { bot_token: '' }, status: 'inactive' },
  { id: 'ch-email', channel: 'email', enabled: false, config: { address: '' }, status: 'inactive' },
  { id: 'ch-discord', channel: 'discord', enabled: false, config: { server_id: '' }, status: 'inactive' },
  { id: 'ch-bitrix', channel: 'bitrix24', enabled: false, config: { webhook_url: '' }, status: 'inactive' },
  { id: 'ch-openclaw', channel: 'openclaw', enabled: false, config: { skill_md: '' }, status: 'inactive' },
];

const DEFAULT_KPIS: MonitoringKPI[] = [
  { id: 'kpi-latency', name: 'Latência P95', target: '< 3s', icon: '⏱️', enabled: true },
  { id: 'kpi-success', name: 'Taxa de Sucesso', target: '> 95%', icon: '✅', enabled: true },
  { id: 'kpi-satisfaction', name: 'Satisfação do Usuário', target: '> 4.0/5', icon: '⭐', enabled: true },
  { id: 'kpi-cost', name: 'Custo por Interação', target: '< $0.05', icon: '💰', enabled: false },
  { id: 'kpi-hallucination', name: 'Taxa de Alucinação', target: '< 5%', icon: '🎭', enabled: true },
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
              onClick={() => updateAgent({ deploy_environment: env.value as typeof agent.deploy_environment })}
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
          <ToggleField label="Auto Scaling" checked={agent.auto_scaling} onCheckedChange={(v) => updateAgent({ auto_scaling: v })} />
          <ToggleField label="Logging Habilitado" checked={agent.logging_enabled} onCheckedChange={(v) => updateAgent({ logging_enabled: v })} />
        </div>
      </section>

      {/* Canais */}
      <section>
        <SectionTitle
          icon="📡"
          title="Canais de Deploy"
          subtitle="Ative os canais onde o agente estará disponível."
          badge={<NexusBadge color="blue">{activeChannels}/{channels.length} ativos</NexusBadge>}
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
                    onCheckedChange={(v) => updateChannel(ch.id, { enabled: v, status: v ? 'active' : 'inactive' })}
                  />
                </div>
                {ch.enabled && (
                  <div className="space-y-2">
                    {Object.entries(ch.config).map(([key, value]) => (
                      <div key={key}>
                        <label className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, ' ')}</label>
                        <input
                          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground"
                          value={value}
                          onChange={(e) =>
                            updateChannel(ch.id, { config: { ...ch.config, [key]: e.target.value } })
                          }
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${ch.status === 'active' ? 'bg-green-500' : ch.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                      <span className="text-[10px] text-muted-foreground capitalize">{ch.status}</span>
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
          badge={<NexusBadge color="green">{activeKPIs}/{kpis.length} ativos</NexusBadge>}
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
                <ToggleField label="" checked={kpi.enabled} onCheckedChange={(v) => updateKPI(kpi.id, { enabled: v })} />
                <span className="text-lg">{kpi.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{kpi.name}</p>
                  <p className="text-[11px] text-muted-foreground">Target: {kpi.target}</p>
                </div>
              </div>
              {kpi.enabled && (
                <input
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
        <SectionTitle icon="💸" title="Orçamento & Alertas" subtitle="Controle de custos e alertas de budget." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Budget Mensal (USD)</label>
            <input
              type="number"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
              value={agent.monthly_budget ?? ''}
              onChange={(e) => updateAgent({ monthly_budget: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Ex: 500"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Alerta em (%)</label>
            <input
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

      {/* Seção E — Estratégia de Deploy */}
      <section>
        <SectionTitle icon="🚦" title="Estratégia de Deploy" subtitle="Como a nova versão será publicada em produção." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'big_bang', icon: '🚀', title: 'Big Bang', desc: '100% imediato — para agentes de baixo risco', risk: 'Alto' },
            { id: 'canary', icon: '🐤', title: 'Canary', desc: '5% → 25% → 50% → 100% — progressivo com validação', risk: 'Baixo' },
            { id: 'blue_green', icon: '🔵', title: 'Blue/Green', desc: 'Swap instantâneo com rollback — zero downtime', risk: 'Médio' },
          ].map((strategy) => (
            <button
              key={strategy.id}
              className="text-left rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden="true">{strategy.icon}</span>
                <span className="text-sm font-semibold text-foreground">{strategy.title}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{strategy.desc}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded ${strategy.risk === 'Baixo' ? 'bg-emerald-500/10 text-emerald-400' : strategy.risk === 'Alto' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                Risco: {strategy.risk}
              </span>
            </button>
          ))}
        </div>

        {/* Canary Config */}
        <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Configuração Canary</h4>
          <SliderField label="Tráfego para nova versão" value={agent.ab_testing_enabled ? 50 : 5} onChange={(v) => updateAgent({ ab_testing_enabled: v > 10 })} min={1} max={100} unit="%" description="% do tráfego direcionado para a versão candidata" />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-muted-foreground mb-1">Gate de aprovação automática</p>
              <p className="text-foreground">Accuracy &gt; 80% e Latência &lt; 3s</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-muted-foreground mb-1">Rollback automático se</p>
              <p className="text-foreground">Error rate &gt; 5% ou Custo &gt; 2x baseline</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-amber-400 border-amber-500/30" onClick={() => { updateAgent({ status: 'staging' }); toast.success('Rollback executado — agente voltou para staging'); }}>🔄 Rollback</Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-emerald-400 border-emerald-500/30" onClick={() => { updateAgent({ status: 'production' }); toast.success('Agente promovido para 100% do tráfego em produção'); }}>✅ Promover 100%</Button>
          </div>
        </div>
      </section>

      {/* Seção F — Agent-as-API */}
      <section>
        <SectionTitle icon="🔗" title="Publicar como API" subtitle="Gere automaticamente um endpoint REST para integração programática" badge={<NexusBadge color="blue">Auto-gerado</NexusBadge>} />
        <div className="space-y-4">
          {/* Endpoint */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Endpoint REST</h4>
            <div className="font-mono text-xs bg-muted/30 border border-border rounded-lg p-3 text-primary">
              POST /api/agents/{agent.id || '{agent_id}'}/chat
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Request Body</p>
                <pre className="bg-muted/20 rounded p-2 font-mono text-[10px] text-emerald-400 overflow-x-auto">{`{
  "message": "string",
  "session_id": "uuid",
  "user_id": "string"
}`}</pre>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Response</p>
                <pre className="bg-muted/20 rounded p-2 font-mono text-[10px] text-emerald-400 overflow-x-auto">{`{
  "response": "string",
  "metadata": {
    "tokens": 142,
    "cost": 0.003,
    "latency_ms": 1200
  }
}`}</pre>
              </div>
            </div>
          </div>

          {/* SDK Snippets */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">SDK Snippets</h4>
            <div className="space-y-2">
              {[
                { lang: 'cURL', code: `curl -X POST https://api.nexus.ai/agents/${agent.id || 'AGENT_ID'}/chat \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Olá"}'` },
                { lang: 'Python', code: `import requests\n\nres = requests.post(\n  f"https://api.nexus.ai/agents/${agent.id || 'AGENT_ID'}/chat",\n  headers={"Authorization": "Bearer YOUR_API_KEY"},\n  json={"message": "Olá"}\n)\nprint(res.json()["response"])` },
                { lang: 'JavaScript', code: `const res = await fetch(\n  \`https://api.nexus.ai/agents/${agent.id || 'AGENT_ID'}/chat\`,\n  {\n    method: 'POST',\n    headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },\n    body: JSON.stringify({ message: 'Olá' })\n  }\n);\nconst data = await res.json();` },
              ].map(({ lang, code }) => (
                <details key={lang} className="group">
                  <summary className="text-xs font-medium text-foreground cursor-pointer hover:text-primary transition-colors py-1">
                    {lang}
                  </summary>
                  <pre className="mt-1 bg-muted/20 rounded-lg p-3 font-mono text-[10px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">{code}</pre>
                </details>
              ))}
            </div>
          </div>

          {/* API Key Management */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">API Keys</h4>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono bg-muted/30 border border-border rounded px-3 py-1.5 text-muted-foreground flex-1">nxs_sk_••••••••••••••••••••••••</span>
              <Button variant="outline" size="sm">Gerar Nova</Button>
              <Button variant="outline" size="sm" className="text-destructive">Revogar</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Rate limit: 100 req/min · Usage tracking por chave</p>
          </div>
        </div>
      </section>

      {/* ═══ OPENCLAW DEPLOY ═══ */}
      <section>
        <SectionTitle icon="🦞" title="OpenClaw Deploy" subtitle="Gere SOUL.md + SKILL.md para deploy no OpenClaw runtime" />
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">OpenClaw Package</p>
              <p className="text-[11px] text-muted-foreground">Exporta personalidade (SOUL.md) + capacidades (SKILL.md) do agente</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const pkg = openClaw.generateDeployPackage(agent);
                toast.success(`Package gerado: SOUL.md + ${pkg.skills.length} skills`);
                // Show preview
                const preview = `SOUL.md:\n${pkg.soulMd.slice(0, 200)}...\n\nSkills: ${pkg.skills.map(s => s.name).join(', ')}`;
                alert(preview);
              }}>Preview</Button>
              <Button size="sm" className="gap-1.5" onClick={() => {
                openClaw.downloadDeployPackage(agent);
                toast.success('OpenClaw package baixado!');
              }}>
                Download Package
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="font-semibold text-foreground mb-1">SOUL.md</p>
              <p className="text-muted-foreground">Personalidade, tom, regras, escopo, fallback</p>
              <p className="text-[10px] text-primary mt-1">Gerado de: persona + mission + system_prompt</p>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="font-semibold text-foreground mb-1">SKILL.md ({agent.tools?.filter((t: { enabled: boolean }) => t.enabled).length ?? 0} skills)</p>
              <p className="text-muted-foreground">APIs e ferramentas que o agente pode chamar</p>
              <p className="text-[10px] text-primary mt-1">Gerado de: tools habilitadas</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Canais suportados: WhatsApp · Telegram · Slack · Discord · Web</span>
            <span className="text-primary">|</span>
            <a href="https://docs.openclaw.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Docs OpenClaw</a>
          </div>
        </div>
      </section>
    </div>
  );
}
