import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon, Palette, Globe, Bell, Key, Code,
  Eye, EyeOff, Copy, Trash2, Plus, Check, AlertTriangle, Save, X,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import * as llm from "@/services/llmService";

// ═══ PERSISTENCE ═══

interface WorkspaceSettings {
  workspaceName: string;
  language: string;
  timezone: string;
  defaultModel: string;
  theme: string;
  accentColor: string;
  notifications: {
    emailAlerts: boolean;
    budgetAlerts: boolean;
    slackAlerts: boolean;
    dailySummary: boolean;
    deployAlerts: boolean;
  };
  apiKeys: { id: string; name: string; value: string; provider: string }[];
  webhooks: { id: string; url: string; events: string[]; active: boolean }[];
  advanced: {
    traceRetention: number;
    rateLimit: number;
    lgpdMode: boolean;
  };
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  workspaceName: 'Promo Brindes',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  defaultModel: 'claude-sonnet-4',
  theme: 'dark',
  accentColor: '#4D96FF',
  notifications: { emailAlerts: true, budgetAlerts: true, slackAlerts: false, dailySummary: false, deployAlerts: true },
  apiKeys: [],
  webhooks: [
    { id: '1', url: 'https://hooks.slack.com/services/...', events: ['agent.error', 'guardrail.block'], active: true },
    { id: '2', url: 'https://n8n.promobrindes.com/webhook/...', events: ['agent.deploy', 'test.complete'], active: true },
  ],
  advanced: { traceRetention: 90, rateLimit: 1000, lgpdMode: true },
};

function loadSettings(): WorkspaceSettings {
  try {
    const stored = localStorage.getItem('nexus_settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(settings: WorkspaceSettings) {
  try { localStorage.setItem('nexus_settings', JSON.stringify(settings)); } catch { /* quota */ }
}

// ═══ SECTIONS ═══

type Section = 'appearance' | 'general' | 'notifications' | 'api_keys' | 'webhooks' | 'advanced';

const SECTIONS = [
  { id: 'appearance' as Section, icon: Palette, title: 'Aparência', desc: 'Tema, logo e personalização visual' },
  { id: 'general' as Section, icon: Globe, title: 'Geral', desc: 'Nome do workspace, idioma, timezone' },
  { id: 'notifications' as Section, icon: Bell, title: 'Notificações', desc: 'Alertas por email e Slack' },
  { id: 'api_keys' as Section, icon: Key, title: 'API Keys', desc: 'Chaves de API e tokens de acesso' },
  { id: 'webhooks' as Section, icon: Code, title: 'Webhooks', desc: 'Endpoints para eventos do sistema' },
  { id: 'advanced' as Section, icon: SettingsIcon, title: 'Avançado', desc: 'Limites, retenção e segurança' },
];

// ═══ MAIN PAGE ═══

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>(loadSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const update = useCallback((partial: Partial<WorkspaceSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    saveSettings(settings);
    setHasChanges(false);
    toast.success('Configurações salvas com sucesso!');
  }, [settings]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Settings"
        description="Configure seu workspace e preferências da plataforma"
        actions={
          <Button onClick={handleSave} disabled={!hasChanges} className="nexus-gradient-bg text-primary-foreground gap-2">
            <Save className="h-4 w-4" /> {hasChanges ? 'Salvar Alterações' : 'Salvo'}
          </Button>
        }
      />

      {hasChanges && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 flex items-center gap-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Alterações não salvas — clique em "Salvar Alterações" para persistir.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
            className={`nexus-card text-left transition-all ${activeSection === s.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:ring-1 hover:ring-primary/30'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activeSection === s.id ? 'bg-primary/20' : 'bg-primary/10'}`}>
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {activeSection && (
        <div key={activeSection}>
          {activeSection === 'appearance' && <AppearanceSection settings={settings} update={update} />}
          {activeSection === 'general' && <GeneralSection settings={settings} update={update} />}
          {activeSection === 'notifications' && <NotificationsSection settings={settings} update={update} />}
          {activeSection === 'api_keys' && <ApiKeysSection settings={settings} update={update} />}
          {activeSection === 'webhooks' && <WebhooksSection settings={settings} update={update} />}
          {activeSection === 'advanced' && <AdvancedSection settings={settings} update={update} />}
        </div>
      )}
    </div>
  );
}

// ═══ SHARED COMPONENTS ═══

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="nexus-card space-y-4"><h3 className="text-sm font-heading font-semibold text-foreground">{title}</h3>{children}</div>;
}

function FieldRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div><p className="text-sm text-foreground">{label}</p>{desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}</div>
      {children}
    </div>
  );
}

// ═══ SECTION COMPONENTS ═══

interface SectionProps { settings: WorkspaceSettings; update: (p: Partial<WorkspaceSettings>) => void }

function AppearanceSection({ settings, update }: SectionProps) {
  const { setTheme } = useTheme();
  return (
    <SectionCard title="Aparência">
      <FieldRow label="Tema" desc="Altera o tema visual do sistema">
        <select value={settings.theme} onChange={e => { update({ theme: e.target.value }); setTheme(e.target.value); toast.success(`Tema: ${e.target.value}`); }} className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="dark">Dark (padrão)</option>
          <option value="light">Light</option>
          <option value="system">Sistema</option>
        </select>
      </FieldRow>
      <FieldRow label="Cor de destaque" desc="Cor primária do workspace">
        <div className="flex gap-2">
          {['#4D96FF', '#6BCB77', '#FF6B6B', '#FFD93D', '#9B59B6'].map(c => (
            <button key={c} onClick={() => { update({ accentColor: c }); toast.success(`Cor: ${c}`); }}
              className={`h-6 w-6 rounded-full border-2 transition-colors ${settings.accentColor === c ? 'border-foreground scale-110' : 'border-transparent hover:border-foreground/50'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </FieldRow>
    </SectionCard>
  );
}

function GeneralSection({ settings, update }: SectionProps) {
  return (
    <SectionCard title="Geral">
      <FieldRow label="Nome do workspace">
        <input value={settings.workspaceName} onChange={e => update({ workspaceName: e.target.value })} className="text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground w-48 text-right" />
      </FieldRow>
      <FieldRow label="Idioma">
        <select value={settings.language} onChange={e => update({ language: e.target.value })} className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </FieldRow>
      <FieldRow label="Timezone">
        <select value={settings.timezone} onChange={e => update({ timezone: e.target.value })} className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
          <option value="America/New_York">New York (UTC-5)</option>
          <option value="Europe/London">London (UTC+0)</option>
          <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
        </select>
      </FieldRow>
      <FieldRow label="Modelo padrão para novos agentes">
        <select value={settings.defaultModel} onChange={e => update({ defaultModel: e.target.value })} className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          {llm.AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </FieldRow>
    </SectionCard>
  );
}

function NotificationsSection({ settings, update }: SectionProps) {
  const toggle = (key: keyof WorkspaceSettings['notifications']) => {
    update({ notifications: { ...settings.notifications, [key]: !settings.notifications[key] } });
  };
  return (
    <SectionCard title="Notificações">
      <FieldRow label="Alertas por email" desc="Receber alertas de erros e guardrails por email">
        <Switch checked={settings.notifications.emailAlerts} onCheckedChange={() => toggle('emailAlerts')} />
      </FieldRow>
      <FieldRow label="Alertas de budget" desc="Notificar quando o custo atingir o limite">
        <Switch checked={settings.notifications.budgetAlerts} onCheckedChange={() => toggle('budgetAlerts')} />
      </FieldRow>
      <FieldRow label="Notificações Slack" desc="Enviar alertas para canal do Slack">
        <Switch checked={settings.notifications.slackAlerts} onCheckedChange={() => toggle('slackAlerts')} />
      </FieldRow>
      <FieldRow label="Resumo diário" desc="Resumo das métricas todo dia às 9h">
        <Switch checked={settings.notifications.dailySummary} onCheckedChange={() => toggle('dailySummary')} />
      </FieldRow>
      <FieldRow label="Alertas de deploy" desc="Notificar quando agente for promovido para produção">
        <Switch checked={settings.notifications.deployAlerts} onCheckedChange={() => toggle('deployAlerts')} />
      </FieldRow>
    </SectionCard>
  );
}

function ApiKeysSection({ settings, update }: SectionProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState('openrouter');

  const addKey = () => {
    if (!newKeyName || !newKeyValue) { toast.error('Preencha nome e valor'); return; }
    const newKey = { id: `key-${Date.now()}`, name: newKeyName, value: newKeyValue, provider: newKeyProvider };
    update({ apiKeys: [...settings.apiKeys, newKey] });

    // Also configure LLM service if applicable
    if (['openrouter', 'anthropic', 'openai'].includes(newKeyProvider)) {
      llm.configureLLM({ provider: newKeyProvider as 'openrouter' | 'anthropic' | 'openai', apiKey: newKeyValue });
      toast.success(`${newKeyName} salva e LLM configurado (${newKeyProvider})`);
    } else {
      toast.success(`${newKeyName} salva`);
    }
    setNewKeyName('');
    setNewKeyValue('');
  };

  const removeKey = (id: string) => {
    if (!confirm('Remover esta API key?')) return;
    update({ apiKeys: settings.apiKeys.filter(k => k.id !== id) });
    toast.info('API key removida');
  };

  return (
    <SectionCard title="API Keys">
      <div className="space-y-3">
        {settings.apiKeys.map(k => (
          <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{k.name} <span className="text-[10px] text-muted-foreground">({k.provider})</span></p>
              <code className="text-[11px] font-mono text-muted-foreground">
                {showKeys[k.id] ? k.value : k.value.slice(0, 10) + '••••••••••'}
              </code>
            </div>
            <button onClick={() => setShowKeys(p => ({ ...p, [k.id]: !p[k.id] }))} className="text-muted-foreground hover:text-foreground">
              {showKeys[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => { navigator.clipboard.writeText(k.value); toast.success('Copiada'); }} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
            <button onClick={() => removeKey(k.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {settings.apiKeys.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma API key configurada</p>}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Adicionar API Key</p>
        <div className="grid grid-cols-4 gap-2">
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Nome (ex: OpenRouter)" className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
          <input value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} type="password" placeholder="sk-or-v1-..." className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono" />
          <select value={newKeyProvider} onChange={e => setNewKeyProvider(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground">
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
            <option value="other">Outro</option>
          </select>
          <Button size="sm" onClick={addKey} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Chaves são armazenadas no localStorage. Em produção, usar Supabase Vault.
      </p>
    </SectionCard>
  );
}

function WebhooksSection({ settings, update }: SectionProps) {
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState('');

  const addWebhook = () => {
    if (!newUrl) { toast.error('URL é obrigatória'); return; }
    const events = newEvents.split(',').map(e => e.trim()).filter(Boolean);
    update({ webhooks: [...settings.webhooks, { id: `wh-${Date.now()}`, url: newUrl, events: events.length > 0 ? events : ['all'], active: true }] });
    toast.success('Webhook adicionado');
    setNewUrl('');
    setNewEvents('');
  };

  const removeWebhook = (id: string) => {
    update({ webhooks: settings.webhooks.filter(w => w.id !== id) });
    toast.info('Webhook removido');
  };

  const toggleWebhook = (id: string) => {
    update({ webhooks: settings.webhooks.map(w => w.id === id ? { ...w, active: !w.active } : w) });
  };

  return (
    <SectionCard title="Webhooks">
      <div className="space-y-3">
        {settings.webhooks.map(wh => (
          <div key={wh.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono text-foreground block truncate">{wh.url}</code>
              <div className="flex gap-1 mt-1.5">
                {wh.events.map(e => <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{e}</span>)}
              </div>
            </div>
            <Switch checked={wh.active} onCheckedChange={() => toggleWebhook(wh.id)} />
            <button onClick={() => removeWebhook(wh.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono" />
        <input value={newEvents} onChange={e => setNewEvents(e.target.value)} placeholder="agent.error, test.complete" className="w-48 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
        <Button variant="outline" size="sm" onClick={addWebhook}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </SectionCard>
  );
}

function AdvancedSection({ settings, update }: SectionProps) {
  return (
    <SectionCard title="Avançado">
      <FieldRow label="Retenção de traces" desc="Tempo que traces de execução são mantidos">
        <select value={settings.advanced.traceRetention} onChange={e => update({ advanced: { ...settings.advanced, traceRetention: Number(e.target.value) } })} className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
          <option value={180}>180 dias</option>
          <option value={365}>1 ano</option>
        </select>
      </FieldRow>
      <FieldRow label="Rate limiting global" desc="Limite de requisições por minuto">
        <input type="number" value={settings.advanced.rateLimit} onChange={e => update({ advanced: { ...settings.advanced, rateLimit: Number(e.target.value) } })} className="text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground w-24 text-right" />
      </FieldRow>
      <FieldRow label="LGPD Compliance Mode" desc="Conformidade com Lei Geral de Proteção de Dados">
        <Switch checked={settings.advanced.lgpdMode} onCheckedChange={() => update({ advanced: { ...settings.advanced, lgpdMode: !settings.advanced.lgpdMode } })} />
      </FieldRow>
      <div className="pt-4 border-t border-border space-y-3">
        <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            const data = JSON.stringify(settings, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'nexus-settings.json'; a.click();
            URL.revokeObjectURL(url);
            toast.success('Configurações exportadas');
          }}>Exportar configurações</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => {
            if (!confirm('ATENÇÃO: Isso vai resetar TODAS as configurações para o padrão. Continuar?')) return;
            localStorage.removeItem('nexus_settings');
            window.location.reload();
          }}>Resetar para padrão</Button>
        </div>
      </div>
    </SectionCard>
  );
}
