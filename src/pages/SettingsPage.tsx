import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon, Palette, Globe, Bell, Key, Code,
  Eye, EyeOff, Copy, Trash2, Plus, Check, AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Section = 'appearance' | 'general' | 'notifications' | 'api_keys' | 'webhooks' | 'advanced';

const SECTIONS = [
  { id: 'appearance' as Section, icon: Palette, title: 'Aparência', desc: 'Tema, logo e personalização visual' },
  { id: 'general' as Section, icon: Globe, title: 'Geral', desc: 'Nome do workspace, idioma, timezone' },
  { id: 'notifications' as Section, icon: Bell, title: 'Notificações', desc: 'Alertas por email e Slack' },
  { id: 'api_keys' as Section, icon: Key, title: 'API Keys', desc: 'Chaves de API e tokens de acesso' },
  { id: 'webhooks' as Section, icon: Code, title: 'Webhooks', desc: 'Endpoints para eventos do sistema' },
  { id: 'advanced' as Section, icon: SettingsIcon, title: 'Avançado', desc: 'Limites, retenção e segurança' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Settings" description="Configure seu workspace e preferências da plataforma" />

      {/* Section selector */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
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
          </motion.button>
        ))}
      </div>

      {/* Section content */}
      {activeSection && (
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'general' && <GeneralSection />}
          {activeSection === 'notifications' && <NotificationsSection />}
          {activeSection === 'api_keys' && <ApiKeysSection />}
          {activeSection === 'webhooks' && <WebhooksSection />}
          {activeSection === 'advanced' && <AdvancedSection />}
        </motion.div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="nexus-card space-y-4">
      <h3 className="text-sm font-heading font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function FieldRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useState('dark');
  return (
    <SectionCard title="Aparência">
      <FieldRow label="Tema" desc="O Nexus Agents Studio usa tema dark por padrão">
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="dark">Dark (padrão)</option>
          <option value="system">Sistema</option>
        </select>
      </FieldRow>
      <FieldRow label="Logo do workspace" desc="Aparece no header e nos emails">
        <Button variant="outline" size="sm">Upload</Button>
      </FieldRow>
      <FieldRow label="Cor de destaque" desc="Cor primária do workspace">
        <div className="flex gap-2">
          {['#4D96FF', '#6BCB77', '#FF6B6B', '#FFD93D', '#9B59B6'].map(c => (
            <button key={c} className="h-6 w-6 rounded-full border-2 border-transparent hover:border-foreground transition-colors" style={{ backgroundColor: c }} />
          ))}
        </div>
      </FieldRow>
    </SectionCard>
  );
}

function GeneralSection() {
  return (
    <SectionCard title="Geral">
      <FieldRow label="Nome do workspace">
        <input defaultValue="Promo Brindes" className="text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground w-48 text-right" />
      </FieldRow>
      <FieldRow label="Idioma">
        <select defaultValue="pt-BR" className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </FieldRow>
      <FieldRow label="Timezone">
        <select defaultValue="America/Sao_Paulo" className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
          <option value="America/New_York">New York (UTC-5)</option>
          <option value="Europe/London">London (UTC+0)</option>
        </select>
      </FieldRow>
      <FieldRow label="Modelo padrão para novos agentes">
        <select defaultValue="claude-sonnet-4.6" className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="claude-sonnet-4.6">Claude Sonnet 4.6</option>
          <option value="claude-opus-4.6">Claude Opus 4.6</option>
          <option value="gpt-4o">GPT-4o</option>
        </select>
      </FieldRow>
    </SectionCard>
  );
}

function NotificationsSection() {
  return (
    <SectionCard title="Notificações">
      <FieldRow label="Alertas por email" desc="Receber alertas de erros e guardrails por email">
        <Switch defaultChecked />
      </FieldRow>
      <FieldRow label="Alertas de budget" desc="Notificar quando o custo atingir o limite definido">
        <Switch defaultChecked />
      </FieldRow>
      <FieldRow label="Notificações Slack" desc="Enviar alertas para canal do Slack">
        <Switch />
      </FieldRow>
      <FieldRow label="Resumo diário" desc="Enviar resumo das métricas dos agentes todo dia às 9h">
        <Switch />
      </FieldRow>
      <FieldRow label="Alertas de deploy" desc="Notificar quando um agente for promovido para produção">
        <Switch defaultChecked />
      </FieldRow>
    </SectionCard>
  );
}

function ApiKeysSection() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const keys = [
    { id: 'anthropic', name: 'Anthropic API Key', value: 'sk-ant-api03-••••••••••••••••', status: 'active' },
    { id: 'openai', name: 'OpenAI API Key', value: 'sk-••••••••••••••••••••••••', status: 'active' },
    { id: 'openrouter', name: 'OpenRouter API Key', value: '', status: 'not_set' },
    { id: 'embedding', name: 'Embedding Provider Key', value: 'sk-emb-••••••••••••••', status: 'active' },
  ];

  return (
    <SectionCard title="API Keys">
      <div className="space-y-3">
        {keys.map(k => (
          <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{k.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {k.value ? (
                  <>
                    <code className="text-[11px] font-mono text-muted-foreground">
                      {showKeys[k.id] ? k.value.replace(/•/g, 'x') : k.value}
                    </code>
                    <button onClick={() => setShowKeys(p => ({ ...p, [k.id]: !p[k.id] }))} className="text-muted-foreground hover:text-foreground">
                      {showKeys[k.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-amber-400">Não configurado</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {k.status === 'active' && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
              <Button variant="outline" size="sm" onClick={() => toast.success(`${k.name} copiada`)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full border-dashed gap-2">
        <Plus className="h-3.5 w-3.5" /> Adicionar API Key
      </Button>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Chaves são armazenadas de forma segura e nunca expostas no frontend.
      </p>
    </SectionCard>
  );
}

function WebhooksSection() {
  const webhooks = [
    { id: '1', url: 'https://hooks.slack.com/services/...', events: ['agent.error', 'guardrail.block'], active: true },
    { id: '2', url: 'https://n8n.promobrindes.com/webhook/...', events: ['agent.deploy', 'test.complete'], active: true },
  ];

  return (
    <SectionCard title="Webhooks">
      <div className="space-y-3">
        {webhooks.map(wh => (
          <div key={wh.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono text-foreground block truncate">{wh.url}</code>
              <div className="flex gap-1 mt-1.5">
                {wh.events.map(e => (
                  <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{e}</span>
                ))}
              </div>
            </div>
            <Switch defaultChecked={wh.active} />
            <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full border-dashed gap-2">
        <Plus className="h-3.5 w-3.5" /> Adicionar Webhook
      </Button>
    </SectionCard>
  );
}

function AdvancedSection() {
  return (
    <SectionCard title="Avançado">
      <FieldRow label="Retenção de traces" desc="Tempo que traces de execução são mantidos">
        <select defaultValue="90" className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="180">180 dias</option>
          <option value="365">1 ano</option>
        </select>
      </FieldRow>
      <FieldRow label="Limite de agentes" desc="Máximo de agentes ativos simultaneamente">
        <span className="text-sm font-mono text-foreground">50 / ilimitado</span>
      </FieldRow>
      <FieldRow label="Rate limiting global" desc="Limite de requisições por minuto em todos os agentes">
        <input type="number" defaultValue={1000} className="text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground w-24 text-right" />
      </FieldRow>
      <FieldRow label="LGPD Compliance Mode" desc="Ativar conformidade com Lei Geral de Proteção de Dados">
        <Switch defaultChecked />
      </FieldRow>
      <div className="pt-4 border-t border-border space-y-3">
        <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success('Dados exportados')}>
            Exportar todos os dados
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
            Deletar workspace
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
