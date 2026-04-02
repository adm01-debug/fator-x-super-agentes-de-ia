import { useState, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, MessageSquare, Globe, Code, Hash, Smartphone, Plus, Trash2, X, Save, Play, RotateCcw, RefreshCw, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import * as widgetService from "@/services/widgetService";
import * as cicdService from "@/services/cicdService";
import { supabase } from "@/integrations/supabase/client";

// Deploy connection stats type
interface DeployConnectionStat {
  message_count: number;
  last_message_at: string;
}

// ═══ TYPES ═══

interface Deployment {
  id: string;
  agent: string;
  channel: string;
  environment: 'production' | 'staging' | 'development';
  version: string;
  previousVersion?: string;
  traffic: number;
  status: 'active' | 'paused' | 'rolling_back' | 'canary';
  strategy: 'big_bang' | 'canary' | 'blue_green';
  canaryPercent: number;
  lastDeployed: string;
  healthScore: number;
}

const CHANNELS = ['API Endpoint', 'Widget de Chat', 'Web App Embed', 'WhatsApp', 'Slack Bot', 'Telegram', 'Email', 'Bitrix24'];
const AGENTS = ['Assistente Comercial', 'Analista de Dados', 'Suporte L1', 'Atendimento WhatsApp', 'Agente BPM'];
const CHANNEL_ICONS: Record<string, React.ElementType> = { 'Widget de Chat': MessageSquare, 'API Endpoint': Code, 'Web App Embed': Globe, 'Slack Bot': Hash, 'WhatsApp': Smartphone, default: Rocket };

const SEED_DEPLOYMENTS: Deployment[] = [
  { id: 'd1', agent: 'Assistente Comercial', channel: 'Widget de Chat', environment: 'production', version: 'v2.4.1', previousVersion: 'v2.3.0', traffic: 100, status: 'active', strategy: 'big_bang', canaryPercent: 0, lastDeployed: '2026-03-31 14:30', healthScore: 98 },
  { id: 'd2', agent: 'Assistente Comercial', channel: 'API Endpoint', environment: 'production', version: 'v2.4.1', traffic: 100, status: 'active', strategy: 'big_bang', canaryPercent: 0, lastDeployed: '2026-03-31 14:30', healthScore: 95 },
  { id: 'd3', agent: 'Suporte L1', channel: 'WhatsApp', environment: 'staging', version: 'v1.2.0', traffic: 20, status: 'canary', strategy: 'canary', canaryPercent: 20, lastDeployed: '2026-03-31 10:00', healthScore: 87 },
  { id: 'd4', agent: 'Analista de Dados', channel: 'Slack Bot', environment: 'production', version: 'v1.0.3', traffic: 100, status: 'active', strategy: 'blue_green', canaryPercent: 0, lastDeployed: '2026-03-29 09:15', healthScore: 92 },
  { id: 'd5', agent: 'Atendimento WhatsApp', channel: 'Web App Embed', environment: 'development', version: 'v0.9.0', traffic: 0, status: 'paused', strategy: 'big_bang', canaryPercent: 0, lastDeployed: '2026-03-28 16:00', healthScore: 0 },
];

// ═══ MAIN PAGE ═══

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>(SEED_DEPLOYMENTS);
  const [showCreate, setShowCreate] = useState(false);
  const [deployStats, setDeployStats] = useState<Record<string, DeployConnectionStat>>({});

  // Fetch deploy_connections stats from Supabase
  useEffect(() => {
    supabase
      .from('deploy_connections' as string)
      .select('channel, message_count, last_message_at')
      .then(({ data, error }) => {
        if (error || !data) return;
        const stats: Record<string, DeployConnectionStat> = {};
        (data as Array<{ channel: string; message_count: number; last_message_at: string }>).forEach((row) => {
          stats[row.channel] = { message_count: row.message_count, last_message_at: row.last_message_at };
        });
        setDeployStats(stats);
      });
  }, []);

  // Create form
  const [newAgent, setNewAgent] = useState(AGENTS[0]);
  const [newChannel, setNewChannel] = useState(CHANNELS[0]);
  const [newEnv, setNewEnv] = useState<Deployment['environment']>('staging');
  const [newStrategy, setNewStrategy] = useState<Deployment['strategy']>('big_bang');
  const [newCanary, setNewCanary] = useState(10);

  // Widget embed state
  const [widgetAgent, setWidgetAgent] = useState(AGENTS[0]);
  const [widgetPosition, setWidgetPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [widgetColor, setWidgetColor] = useState('#4D96FF');
  const [widgetWelcome, setWidgetWelcome] = useState('Olá! Como posso ajudar?');
  const [widgetCode, setWidgetCode] = useState('');

  const createDeploy = useCallback(() => {
    const dep: Deployment = {
      id: `d-${Date.now()}`, agent: newAgent, channel: newChannel, environment: newEnv,
      version: 'v1.0.0', traffic: newStrategy === 'canary' ? newCanary : 100,
      status: newStrategy === 'canary' ? 'canary' : 'active', strategy: newStrategy,
      canaryPercent: newStrategy === 'canary' ? newCanary : 0,
      lastDeployed: new Date().toLocaleString('pt-BR'), healthScore: 100,
    };
    setDeployments(prev => [dep, ...prev]);
    setShowCreate(false);
    toast.success(`Deploy criado: ${newAgent} → ${newChannel} (${newEnv})`);
  }, [newAgent, newChannel, newEnv, newStrategy, newCanary]);

  const rollback = useCallback((id: string) => {
    const dep = deployments.find(d => d.id === id);
    if (!dep?.previousVersion) { toast.error('Sem versão anterior para rollback'); return; }
    if (!confirm(`Rollback "${dep.agent}" no canal "${dep.channel}" de ${dep.version} para ${dep.previousVersion}?`)) return;
    setDeployments(prev => prev.map(d => d.id === id ? {
      ...d, status: 'active' as const, version: d.previousVersion!, previousVersion: d.version,
      lastDeployed: new Date().toLocaleString('pt-BR'),
    } : d));
    toast.success(`Rollback: ${dep.version} → ${dep.previousVersion}`);
  }, [deployments]);

  const togglePause = useCallback((id: string) => {
    setDeployments(prev => prev.map(d => {
      if (d.id !== id) return d;
      const newStatus = d.status === 'paused' ? 'active' as const : 'paused' as const;
      return { ...d, status: newStatus, traffic: newStatus === 'paused' ? 0 : 100 };
    }));
  }, []);

  const promotCanary = useCallback((id: string) => {
    setDeployments(prev => prev.map(d => d.id === id ? { ...d, status: 'active' as const, traffic: 100, canaryPercent: 0, environment: 'production' as const } : d));
    toast.success('Canary promovido para 100% de tráfego!');
  }, []);

  const deleteDeploy = useCallback((id: string) => {
    if (!confirm('Excluir este deployment?')) return;
    setDeployments(prev => prev.filter(d => d.id !== id));
    toast.info('Deployment excluído');
  }, []);

  const updateCanaryTraffic = useCallback((id: string, percent: number) => {
    setDeployments(prev => prev.map(d => d.id === id ? { ...d, canaryPercent: percent, traffic: percent } : d));
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Deployments"
        description="Gerencie deploys dos agentes em múltiplos canais e ambientes"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Novo Deploy</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Deployments ativos', value: deployments.filter(d => d.status === 'active').length, color: 'text-emerald-400' },
          { label: 'Canary em andamento', value: deployments.filter(d => d.status === 'canary').length, color: 'text-amber-400' },
          { label: 'Health médio', value: `${Math.round(deployments.filter(d => d.healthScore > 0).reduce((s, d) => s + d.healthScore, 0) / Math.max(deployments.filter(d => d.healthScore > 0).length, 1))}%`, color: 'text-foreground' },
          { label: 'Canais únicos', value: new Set(deployments.map(d => d.channel)).size, color: 'text-primary' },
        ].map(kpi => (
          <div key={kpi.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Deployments grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deployments.map(dep => {
          const Icon = CHANNEL_ICONS[dep.channel] || CHANNEL_ICONS.default;
          return (
            <div key={dep.id} className={`nexus-card ${dep.status === 'paused' ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{dep.channel}</h3>
                    <p className="text-[11px] text-muted-foreground">{dep.agent}</p>
                  </div>
                </div>
                <StatusBadge status={dep.status === 'active' ? 'production' : dep.status === 'canary' ? 'testing' : dep.status === 'paused' ? 'paused' : 'draft'} />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Ambiente</span><StatusBadge status={dep.environment} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Versão</span><span className="text-foreground font-mono">{dep.version}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estratégia</span><span className="text-foreground">{dep.strategy === 'canary' ? '🐦 Canary' : dep.strategy === 'blue_green' ? '🔵🟢 Blue/Green' : '💥 Big Bang'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tráfego</span><span className="text-foreground">{dep.traffic}%</span></div>
                {dep.status === 'canary' && (
                  <div className="pt-2">
                    <label className="text-[10px] text-muted-foreground">Canary tráfego: {dep.canaryPercent}%</label>
                    <input type="range" min={5} max={100} step={5} value={dep.canaryPercent} onChange={e => updateCanaryTraffic(dep.id, Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Health</span>
                  <span className={`font-mono font-bold ${dep.healthScore >= 90 ? 'text-emerald-400' : dep.healthScore >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{dep.healthScore}%</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deploy</span><span className="text-foreground">{dep.lastDeployed}</span></div>
                {deployStats[dep.channel] && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Mensagens</span><span className="text-foreground font-mono">{deployStats[dep.channel].message_count}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Última msg</span><span className="text-foreground">{new Date(deployStats[dep.channel].last_message_at).toLocaleString('pt-BR')}</span></div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 mt-3 pt-3 border-t border-border/50">
                <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => togglePause(dep.id)}>
                  {dep.status === 'paused' ? <><Play className="h-3 w-3 mr-1" /> Ativar</> : <> Pausar</>}
                </Button>
                {dep.previousVersion && (
                  <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => rollback(dep.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Rollback
                  </Button>
                )}
                {dep.status === 'canary' && (
                  <Button size="sm" className="flex-1 text-[10px] h-7" onClick={() => promotCanary(dep.id)}>
                    <Rocket className="h-3 w-3 mr-1" /> Promover 100%
                  </Button>
                )}
                <button onClick={() => deleteDeploy(dep.id)} className="p-1 rounded hover:bg-destructive/20"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Scheduling */}
      <div className="nexus-card space-y-4">
        <h3 className="text-sm font-heading font-semibold text-foreground">Agendamento de Agentes</h3>
        <p className="text-xs text-muted-foreground">Agende execuções automáticas — agentes proativos que executam sem interação do usuário.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Relatório diário às 9h', cron: '0 9 * * *', agent: 'Analista de Dados', active: true },
            { label: 'Sync CRM a cada 6h', cron: '0 */6 * * *', agent: 'Agente BPM', active: true },
            { label: 'Prospecção semanal (segunda)', cron: '0 8 * * 1', agent: 'SDR Outbound', active: false },
          ].map(sched => (
            <div key={sched.label} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{sched.label}</p>
                <Switch defaultChecked={sched.active} onCheckedChange={() => toast.success(`Schedule ${sched.active ? 'desativado' : 'ativado'}`)} />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{sched.cron}</p>
              <p className="text-[10px] text-muted-foreground">Agente: {sched.agent}</p>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full border-dashed gap-1" onClick={() => toast.info('Configure schedules no Agent Builder > Deploy Module')}>
          <Plus className="h-3.5 w-3.5" /> Novo Agendamento
        </Button>
      </div>

      {/* Webhook Triggers */}
      <div className="nexus-card space-y-4">
        <h3 className="text-sm font-heading font-semibold text-foreground">Webhook Triggers</h3>
        <p className="text-xs text-muted-foreground">Ative agentes automaticamente quando eventos externos acontecem.</p>
        <div className="space-y-2">
          {[
            { event: 'Novo lead no CRM', url: '/api/triggers/new-lead', agent: 'Assistente Comercial', calls: 45, status: 'active' },
            { event: 'Ticket de suporte aberto', url: '/api/triggers/support-ticket', agent: 'Suporte L1', calls: 128, status: 'active' },
            { event: 'Pagamento confirmado', url: '/api/triggers/payment', agent: 'Agente BPM', calls: 23, status: 'active' },
            { event: 'Menção no WhatsApp', url: '/api/triggers/whatsapp', agent: 'Atendimento WhatsApp', calls: 312, status: 'active' },
          ].map(trigger => (
            <div key={trigger.event} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs">
              <div className="flex-1">
                <p className="font-semibold text-foreground">{trigger.event}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{trigger.url}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-muted-foreground">{trigger.agent}</span>
                <span className="font-mono text-foreground">{trigger.calls} calls</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input placeholder="URL do webhook externo..." className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono" />
          <Button variant="outline" size="sm" onClick={() => toast.success('Webhook trigger adicionado')}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Widget Embed Generator */}
      <div className="nexus-card space-y-4">
        <h3 className="text-sm font-heading font-semibold text-foreground">Widget de Chat Embeddable</h3>
        <p className="text-xs text-muted-foreground">Gere um script para embeddar seu agente em qualquer site com uma linha de código.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-[10px] text-muted-foreground">Agente</label>
            <select value={widgetAgent} onChange={e => setWidgetAgent(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mt-1">
              {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div><label className="text-[10px] text-muted-foreground">Posição</label>
            <select value={widgetPosition} onChange={e => setWidgetPosition(e.target.value as 'bottom-right' | 'bottom-left')} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mt-1">
              <option value="bottom-right">Inferior direito</option>
              <option value="bottom-left">Inferior esquerdo</option>
            </select>
          </div>
          <div><label className="text-[10px] text-muted-foreground">Cor primária</label>
            <input type="color" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className="w-full h-8 bg-muted/30 border border-border rounded-lg mt-1 cursor-pointer" />
          </div>
          <div><label className="text-[10px] text-muted-foreground">Mensagem de boas-vindas</label>
            <input value={widgetWelcome} onChange={e => setWidgetWelcome(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mt-1" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1" onClick={() => {
            const code = widgetService.generateEmbedCode({ agentId: `agent-${widgetAgent.toLowerCase().replace(/\s/g, '-')}`, agentName: widgetAgent, position: widgetPosition, primaryColor: widgetColor, welcomeMessage: widgetWelcome });
            setWidgetCode(code);
            toast.success('Código de embed gerado!');
          }}><Code className="h-3.5 w-3.5" /> Gerar Código</Button>
          {widgetCode && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { navigator.clipboard.writeText(widgetCode); toast.success('Código copiado!'); }}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                const html = widgetService.generatePreviewHTML({ agentId: `agent-${widgetAgent.toLowerCase().replace(/\s/g, '-')}`, agentName: widgetAgent, position: widgetPosition, primaryColor: widgetColor, welcomeMessage: widgetWelcome });
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                toast.success('Preview aberto em nova aba');
              }}><Eye className="h-3.5 w-3.5" /> Preview</Button>
            </>
          )}
        </div>
        {widgetCode && (
          <pre className="rounded-xl bg-muted/10 border border-border p-4 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-48">{widgetCode}</pre>
        )}
      </div>

      {/* SDK Code Generator */}
      <div className="nexus-card space-y-4">
        <h3 className="text-sm font-heading font-semibold text-foreground">SDK & Integração</h3>
        <p className="text-xs text-muted-foreground">Integre seu agente em qualquer aplicação com NPM, Python ou cURL.</p>
        <div className="flex gap-2">
          {(['npm', 'python', 'curl'] as const).map(lang => (
            <Button key={lang} variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
              const agentId = `agent-${widgetAgent.toLowerCase().replace(/\s/g, '-')}`;
              const sdk = cicdService.generateSDKCode(agentId, widgetAgent, window.location.origin);
              const code = sdk[lang];
              navigator.clipboard.writeText(code);
              toast.success(`Código ${lang.toUpperCase()} copiado!`);
            }}>
              <Code className="h-3.5 w-3.5" /> {lang === 'npm' ? 'NPM' : lang === 'python' ? 'Python' : 'cURL'}
            </Button>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Novo Deploy</h3><button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Agente</label>
                <select value={newAgent} onChange={e => setNewAgent(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1">
                  {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Canal</label>
                <select value={newChannel} onChange={e => setNewChannel(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1">
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Ambiente</label>
                <select value={newEnv} onChange={e => setNewEnv(e.target.value as Deployment['environment'])} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1">
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Estratégia de Deploy</label>
                <select value={newStrategy} onChange={e => setNewStrategy(e.target.value as Deployment['strategy'])} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1">
                  <option value="big_bang">💥 Big Bang (100% imediato)</option>
                  <option value="canary">🐦 Canary (% gradual)</option>
                  <option value="blue_green">🔵🟢 Blue/Green (swap)</option>
                </select>
              </div>
              {newStrategy === 'canary' && (
                <div><label className="text-xs text-muted-foreground">Tráfego inicial do Canary: {newCanary}%</label>
                  <input type="range" min={5} max={50} step={5} value={newCanary} onChange={e => setNewCanary(Number(e.target.value))} className="w-full accent-primary mt-1" />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button size="sm" onClick={createDeploy} className="gap-1"><Rocket className="h-3.5 w-3.5" /> Deploy</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
