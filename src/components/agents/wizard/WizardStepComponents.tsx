/* eslint-disable react-refresh/only-export-components */
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Database,
  Check,
  Shield,
  MessageSquare,
  Search as SearchIcon,
  BarChart3,
  Headphones,
  Users,
  Layers,
  Globe,
  Code,
  Mail,
  Calendar,
  Hash,
  Webhook,
} from 'lucide-react';

const AGENT_TYPES = [
  { id: 'chatbot', label: 'Chatbot', icon: MessageSquare, desc: 'Conversação com usuários finais' },
  { id: 'copilot', label: 'Copiloto', icon: Sparkles, desc: 'Assistente para equipes internas' },
  { id: 'analyst', label: 'Analista', icon: BarChart3, desc: 'Análise de dados e relatórios' },
  { id: 'sdr', label: 'SDR', icon: Users, desc: 'Prospecção e qualificação de leads' },
  { id: 'support', label: 'Suporte', icon: Headphones, desc: 'Atendimento L1/L2 automatizado' },
  {
    id: 'researcher',
    label: 'Pesquisador',
    icon: SearchIcon,
    desc: 'Pesquisa web e análise documental',
  },
  {
    id: 'orchestrator',
    label: 'Orquestrador',
    icon: Layers,
    desc: 'Coordena múltiplos sub-agentes',
  },
];

export const MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    cost: '$$',
    speed: 'Rápido',
    quality: 'Excelente',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    cost: '$$$',
    speed: 'Médio',
    quality: 'Máxima',
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    cost: '$$',
    speed: 'Rápido',
    quality: 'Excelente',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    cost: '$$$',
    speed: 'Lento',
    quality: 'Máxima',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    cost: '$',
    speed: 'Rápido',
    quality: 'Muito boa',
  },
  {
    id: 'llama-3-70b',
    name: 'Llama 3 70B',
    provider: 'Meta (open)',
    cost: '$',
    speed: 'Médio',
    quality: 'Boa',
  },
];

const TOOLS = [
  { id: 'web_search', name: 'Web Search', icon: Globe, category: 'Busca' },
  { id: 'code_exec', name: 'Code Execution', icon: Code, category: 'Dev' },
  { id: 'sql_query', name: 'SQL Query', icon: Database, category: 'Dados' },
  { id: 'email', name: 'Email', icon: Mail, category: 'Comunicação' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, category: 'Produtividade' },
  { id: 'slack', name: 'Slack', icon: Hash, category: 'Comunicação' },
  { id: 'webhook', name: 'Webhooks', icon: Webhook, category: 'Integração' },
  { id: 'crm', name: 'CRM', icon: Users, category: 'Vendas' },
];

const MEMORY_OPTIONS = [
  {
    id: 'short_term',
    label: 'Memória de curto prazo',
    desc: 'Contexto da conversa atual',
    default: true,
  },
  {
    id: 'episodic',
    label: 'Memória episódica',
    desc: 'Interações passadas relevantes',
    default: false,
  },
  {
    id: 'semantic',
    label: 'Memória semântica',
    desc: 'Conhecimento geral aprendido',
    default: false,
  },
  {
    id: 'user_profile',
    label: 'Perfil do usuário',
    desc: 'Preferências e histórico do user',
    default: true,
  },
  {
    id: 'team_shared',
    label: 'Memória compartilhada',
    desc: 'Contexto do time/workspace',
    default: false,
  },
];

type FormType = Record<string, string | string[]>;

export function StepIdentity({
  form,
  update,
}: {
  form: FormType;
  update: (k: string, v: unknown) => void;
}) {
  return (
    <div className="nexus-card space-y-5">
      <h2 className="text-lg font-heading font-semibold text-foreground">Identidade do agente</h2>
      <div className="grid gap-4">
        <div>
          <Label className="text-sm">Nome do agente *</Label>
          <Input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ex: Atlas, Scout, Sentinel..."
            className="mt-1.5 bg-secondary/50 border-border/50"
          />
        </div>
        <div>
          <Label className="text-sm">Descrição</Label>
          <Textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Descreva o propósito deste agente..."
            rows={3}
            className="mt-1.5 bg-secondary/50 border-border/50 resize-none"
          />
        </div>
        <div>
          <Label className="text-sm">Objetivo principal</Label>
          <Input
            value={form.objective}
            onChange={(e) => update('objective', e.target.value)}
            placeholder="Ex: Atender dúvidas técnicas de clientes premium"
            className="mt-1.5 bg-secondary/50 border-border/50"
          />
        </div>
      </div>
    </div>
  );
}

export function StepType({
  form,
  update,
}: {
  form: FormType;
  update: (k: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Tipo do agente</h2>
      <p className="text-sm text-muted-foreground">
        Selecione o tipo que melhor descreve o papel deste agente.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TYPES.map((t) => {
          const Icon = t.icon;
          const selected = form.type === t.id;
          return (
            <button
              key={t.id}
              onClick={() => update('type', t.id)}
              className={`nexus-card text-left transition-all ${selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${selected ? 'bg-primary/20' : 'bg-secondary'}`}
                >
                  <Icon
                    className={`h-5 w-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                </div>
                <span className="font-medium text-sm text-foreground">{t.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepModel({
  form,
  update,
}: {
  form: FormType;
  update: (k: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Modelo base</h2>
      <p className="text-sm text-muted-foreground">
        Escolha o modelo de linguagem para este agente.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODELS.map((m) => {
          const selected = form.model === m.id;
          return (
            <button
              key={m.id}
              onClick={() => update('model', m.id)}
              className={`nexus-card text-left transition-all ${selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground">{m.name}</span>
                <Badge variant="outline" className="text-[11px]">
                  {m.provider}
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>
                  Custo: <strong className="text-foreground">{m.cost}</strong>
                </span>
                <span>
                  Velocidade: <strong className="text-foreground">{m.speed}</strong>
                </span>
                <span>
                  Qualidade: <strong className="text-foreground">{m.quality}</strong>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepPrompt({
  form,
  update,
}: {
  form: FormType;
  update: (k: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">System Prompt</h2>
      <p className="text-sm text-muted-foreground">
        Defina as instruções de comportamento do agente.
      </p>
      <div className="nexus-card">
        <Textarea
          value={form.prompt}
          onChange={(e) => update('prompt', e.target.value)}
          rows={14}
          className="bg-secondary/50 border-border/50 font-mono text-xs leading-relaxed resize-none"
        />
      </div>
    </div>
  );
}

export function StepTools({ form, toggle }: { form: FormType; toggle: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Ferramentas</h2>
      <p className="text-sm text-muted-foreground">
        Habilite as ferramentas que o agente poderá utilizar.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const selected = (form.tools as string[]).includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`nexus-card text-left transition-all relative ${selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'}`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center ${selected ? 'bg-primary/20' : 'bg-secondary'}`}
                >
                  <Icon
                    className={`h-4 w-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.category}</p>
                </div>
              </div>
              {selected && <Check className="h-3.5 w-3.5 text-primary absolute top-2 right-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepMemory({ form, toggle }: { form: FormType; toggle: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Memória</h2>
      <p className="text-sm text-muted-foreground">Configure as camadas de memória do agente.</p>
      <div className="space-y-3">
        {MEMORY_OPTIONS.map((m) => {
          const enabled = (form.memory as string[]).includes(m.id);
          return (
            <div key={m.id} className="nexus-card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={() => toggle(m.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StepKnowledge({ form, toggle }: { form: FormType; toggle: (id: string) => void }) {
  const kbs = [
    { id: 'kb-docs', name: 'Documentação Técnica', docs: 342, status: 'synced' },
    { id: 'kb-faq', name: 'FAQ & Suporte', docs: 89, status: 'synced' },
    { id: 'kb-legal', name: 'Políticas & Compliance', docs: 156, status: 'syncing' },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Knowledge Base</h2>
      <p className="text-sm text-muted-foreground">Vincule bases de conhecimento para RAG.</p>
      <div className="space-y-3">
        {kbs.map((kb) => {
          const selected = (form.knowledgeBases as string[]).includes(kb.id);
          return (
            <button
              key={kb.id}
              onClick={() => toggle(kb.id)}
              className={`nexus-card w-full text-left flex items-center justify-between transition-all ${selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${selected ? 'bg-primary/20' : 'bg-secondary'}`}
                >
                  <Database
                    className={`h-5 w-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{kb.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kb.docs} documentos •{' '}
                    {kb.status === 'synced' ? 'Sincronizado' : 'Sincronizando...'}
                  </p>
                </div>
              </div>
              {selected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepDeploy({
  form,
  update,
}: {
  form: FormType;
  update: (k: string, v: unknown) => void;
}) {
  const envs = [
    { id: 'development', label: 'Development', desc: 'Testes internos' },
    { id: 'staging', label: 'Staging', desc: 'Validação pré-produção' },
    { id: 'production', label: 'Production', desc: 'Acesso por usuários finais' },
  ];
  const selectedType = AGENT_TYPES.find((t) => t.id === form.type);
  const selectedModel = MODELS.find((m) => m.id === form.model);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Revisão & Deploy</h2>
      <div className="nexus-card space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Nome:</span>{' '}
            <strong className="text-foreground ml-1">{String(form.name || '—')}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Tipo:</span>{' '}
            <strong className="text-foreground ml-1">{selectedType?.label || '—'}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Modelo:</span>{' '}
            <strong className="text-foreground ml-1">{selectedModel?.name || '—'}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Ferramentas:</span>{' '}
            <strong className="text-foreground ml-1">
              {(form.tools as string[]).length} selecionadas
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground">Memória:</span>{' '}
            <strong className="text-foreground ml-1">
              {(form.memory as string[]).length} camadas
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground">Knowledge:</span>{' '}
            <strong className="text-foreground ml-1">
              {(form.knowledgeBases as string[]).length} bases
            </strong>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {envs.map((e) => {
          const selected = form.environment === e.id;
          return (
            <button
              key={e.id}
              onClick={() => update('environment', e.id)}
              className={`nexus-card text-left transition-all ${selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`h-2 w-2 rounded-full ${e.id === 'production' ? 'bg-nexus-emerald' : e.id === 'staging' ? 'bg-nexus-amber' : 'bg-muted-foreground'}`}
                />
                <span className="text-sm font-medium text-foreground">{e.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{e.desc}</p>
            </button>
          );
        })}
      </div>
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Guardrails recomendados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Após a criação, configure PII masking, limites de custo e moderação na aba Security.
          </p>
        </div>
      </div>
    </div>
  );
}

export { AGENT_TYPES };
