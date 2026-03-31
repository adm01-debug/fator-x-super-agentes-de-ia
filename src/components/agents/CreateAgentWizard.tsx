import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Sparkles, Brain, Puzzle, FileText, Database, Rocket, Check,
  ArrowLeft, ArrowRight, User, MessageSquare, Search as SearchIcon,
  BarChart3, Headphones, Users, Layers, ChevronRight,
  Globe, Code, Mail, Calendar, Hash, Webhook, Shield, Zap,
  LayoutTemplate, PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AGENT_TEMPLATES, templateToConfig, type AgentTemplate } from "@/data/agentTemplates";
import { DEFAULT_AGENT } from "@/data/agentBuilderData";
import * as agentService from "@/services/agentService";

const STEPS = [
  { key: "identity", label: "Identidade", icon: User, description: "Nome, descrição e objetivo" },
  { key: "type", label: "Tipo", icon: Bot, description: "Tipo do agente" },
  { key: "model", label: "Modelo", icon: Sparkles, description: "Modelo base de IA" },
  { key: "prompt", label: "Prompt", icon: FileText, description: "Prompt do sistema" },
  { key: "tools", label: "Ferramentas", icon: Puzzle, description: "Ferramentas habilitadas" },
  { key: "memory", label: "Memória", icon: Brain, description: "Configuração de memória" },
  { key: "knowledge", label: "Knowledge", icon: Database, description: "Base de conhecimento" },
  { key: "deploy", label: "Deploy", icon: Rocket, description: "Revisão e publicação" },
] as const;

const TEMPLATE_STEPS = [
  { key: "select", label: "Escolher Template", icon: LayoutTemplate, description: "Selecione um modelo" },
  { key: "customize", label: "Personalizar", icon: PenTool, description: "Ajuste nome e prompt" },
  { key: "review", label: "Revisar & Criar", icon: Rocket, description: "Confirme e crie" },
] as const;

const AGENT_TYPES = [
  { id: "chatbot", label: "Chatbot", icon: MessageSquare, desc: "Conversação com usuários finais" },
  { id: "copilot", label: "Copiloto", icon: Sparkles, desc: "Assistente para equipes internas" },
  { id: "analyst", label: "Analista", icon: BarChart3, desc: "Análise de dados e relatórios" },
  { id: "sdr", label: "SDR", icon: Users, desc: "Prospecção e qualificação de leads" },
  { id: "support", label: "Suporte", icon: Headphones, desc: "Atendimento L1/L2 automatizado" },
  { id: "researcher", label: "Pesquisador", icon: SearchIcon, desc: "Pesquisa web e análise documental" },
  { id: "orchestrator", label: "Orquestrador", icon: Layers, desc: "Coordena múltiplos sub-agentes" },
];

const MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", cost: "$$", speed: "Rápido", quality: "Excelente" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", cost: "$$$", speed: "Médio", quality: "Máxima" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", cost: "$$", speed: "Rápido", quality: "Excelente" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", cost: "$$$", speed: "Lento", quality: "Máxima" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google", cost: "$", speed: "Rápido", quality: "Muito boa" },
  { id: "llama-3-70b", name: "Llama 3 70B", provider: "Meta (open)", cost: "$", speed: "Médio", quality: "Boa" },
];

const TOOLS = [
  { id: "web_search", name: "Web Search", icon: Globe, category: "Busca" },
  { id: "code_exec", name: "Code Execution", icon: Code, category: "Dev" },
  { id: "sql_query", name: "SQL Query", icon: Database, category: "Dados" },
  { id: "email", name: "Email", icon: Mail, category: "Comunicação" },
  { id: "calendar", name: "Calendar", icon: Calendar, category: "Produtividade" },
  { id: "slack", name: "Slack", icon: Hash, category: "Comunicação" },
  { id: "webhook", name: "Webhooks", icon: Webhook, category: "Integração" },
  { id: "crm", name: "CRM", icon: Users, category: "Vendas" },
];

const MEMORY_OPTIONS = [
  { id: "short_term", label: "Memória de curto prazo", desc: "Contexto da conversa atual", default: true },
  { id: "episodic", label: "Memória episódica", desc: "Interações passadas relevantes", default: false },
  { id: "semantic", label: "Memória semântica", desc: "Conhecimento geral aprendido", default: false },
  { id: "user_profile", label: "Perfil do usuário", desc: "Preferências e histórico do user", default: true },
  { id: "team_shared", label: "Memória compartilhada", desc: "Contexto do time/workspace", default: false },
];

type WizardMode = "choose" | "template" | "scratch";

export function CreateAgentWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<WizardMode>("choose");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "",
    type: "",
    model: "gpt-4o",
    prompt: `Você é um assistente profissional da empresa.

## Persona
- Tom profissional e acolhedor
- Respostas precisas e concisas

## Escopo
- Responder dúvidas sobre o produto
- Guiar integrações e configurações
- Escalar para humano quando fora do escopo

## Formato
- Use markdown para formatação
- Máximo 300 palavras por resposta`,
    tools: [] as string[],
    memory: ["short_term", "user_profile"] as string[],
    knowledgeBases: [] as string[],
    environment: "development" as string,
  });

  const update = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleArrayItem = (key: string, item: string) => {
    const arr = form[key as keyof typeof form] as string[];
    update(key, arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]);
  };

  const currentSteps = mode === "template" ? TEMPLATE_STEPS : STEPS;
  const next = () => step < currentSteps.length - 1 && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const applyTemplate = (t: AgentTemplate) => {
    setSelectedTemplate(t);
    setForm(prev => ({
      ...prev,
      name: t.name,
      description: t.description,
      type: t.type,
      model: t.model,
      prompt: t.prompt,
      tools: t.tools,
      memory: t.memory,
    }));
  };

  const saveAgent = async () => {
    if (!user) {
      toast.error("Faça login para criar agentes");
      navigate("/auth");
      return;
    }
    setSaving(true);

    try {
      // Build full AgentConfig from template or scratch
      let agentConfig;
      if (selectedTemplate) {
        agentConfig = templateToConfig(selectedTemplate);
        agentConfig.name = form.name;
        agentConfig.mission = form.description || selectedTemplate.description;
        agentConfig.system_prompt = form.prompt;
      } else {
        agentConfig = {
          ...DEFAULT_AGENT,
          name: form.name,
          mission: form.objective || form.description,
          system_prompt: form.prompt,
          avatar_emoji: '🤖',
          model: (form.model === 'gpt-4o' ? 'gpt-4o' : form.model === 'claude-3.5-sonnet' ? 'claude-sonnet-4.6' : form.model === 'gemini-1.5-pro' ? 'gemini-2.5-pro' : 'claude-sonnet-4.6') as typeof DEFAULT_AGENT.model,
          memory_short_term: form.memory.includes('short_term'),
          memory_episodic: form.memory.includes('episodic'),
          memory_semantic: form.memory.includes('semantic'),
          memory_profile: form.memory.includes('user_profile'),
          memory_shared: form.memory.includes('team_shared'),
        };
      }

      await agentService.saveAgent(agentConfig, user.id);
      toast.success("Agente criado com sucesso!", {
        description: `${form.name} foi salvo no banco de dados.`,
      });
      navigate("/agents");
    } catch (err) {
      toast.error("Erro ao salvar agente", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (mode === "template") {
      if (step === 0) return selectedTemplate !== null;
      if (step === 1) return form.name.trim().length > 0;
      return true;
    }
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return form.type.length > 0;
    return true;
  };

  // Choose mode screen
  if (mode === "choose") {
    return (
      <div className="p-6 max-w-[900px] mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/agents")} className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Criar novo agente</h1>
            <p className="text-sm text-muted-foreground">Escolha como deseja começar</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => { setMode("template"); setStep(0); }}
            className="nexus-card text-left transition-all hover:ring-2 hover:ring-primary/50 space-y-3 p-6"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <LayoutTemplate className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-foreground">Usar template</h2>
            <p className="text-sm text-muted-foreground">
              Comece com um dos 6 templates pré-configurados e personalize em 3 passos rápidos.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_TEMPLATES.slice(0, 3).map(t => (
                <span key={t.id} className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                  {t.emoji} {t.name}
                </span>
              ))}
              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">+3</span>
            </div>
          </button>

          <button onClick={() => { setMode("scratch"); setStep(0); }}
            className="nexus-card text-left transition-all hover:ring-2 hover:ring-primary/50 space-y-3 p-6"
          >
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
              <PenTool className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-foreground">Criar do zero</h2>
            <p className="text-sm text-muted-foreground">
              Configure cada detalhe manualmente em 8 etapas com controle total.
            </p>
          </button>
        </div>
      </div>
    );
  }

  const renderTemplateStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-heading font-semibold text-foreground">Escolha um template</h2>
            <p className="text-sm text-muted-foreground">Selecione o template que mais se aproxima do seu caso de uso.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AGENT_TEMPLATES.map(t => {
                const selected = selectedTemplate?.id === t.id;
                return (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className={`nexus-card text-left transition-all ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/60"}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{t.emoji}</span>
                      <div>
                        <p className="font-medium text-sm text-foreground">{t.name}</p>
                        <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    {selected && <Check className="h-4 w-4 text-primary absolute top-3 right-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="nexus-card space-y-5">
            <h2 className="text-lg font-heading font-semibold text-foreground">Personalizar</h2>
            <div className="grid gap-4">
              <div>
                <Label className="text-sm">Nome do agente *</Label>
                <Input value={form.name} onChange={e => update("name", e.target.value)}
                  placeholder="Ex: Atlas, Scout..." className="mt-1.5 bg-secondary/50 border-border/50" />
              </div>
              <div>
                <Label className="text-sm">Descrição</Label>
                <Input value={form.description} onChange={e => update("description", e.target.value)}
                  placeholder="Descreva o propósito..." className="mt-1.5 bg-secondary/50 border-border/50" />
              </div>
              <div>
                <Label className="text-sm">System Prompt</Label>
                <Textarea value={form.prompt} onChange={e => update("prompt", e.target.value)}
                  rows={10} className="mt-1.5 bg-secondary/50 border-border/50 font-mono text-xs resize-none" />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-heading font-semibold text-foreground">Revisar & Criar</h2>
            <div className="nexus-card space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Nome:</span> <strong className="text-foreground ml-1">{form.name}</strong></div>
                <div><span className="text-muted-foreground">Template:</span> <strong className="text-foreground ml-1">{selectedTemplate?.name}</strong></div>
                <div><span className="text-muted-foreground">Modelo:</span> <strong className="text-foreground ml-1">{MODELS.find(m => m.id === form.model)?.name}</strong></div>
                <div><span className="text-muted-foreground">Ferramentas:</span> <strong className="text-foreground ml-1">{form.tools.length} selecionadas</strong></div>
                <div><span className="text-muted-foreground">Memória:</span> <strong className="text-foreground ml-1">{form.memory.length} camadas</strong></div>
                <div><span className="text-muted-foreground">Tipo:</span> <strong className="text-foreground ml-1">{AGENT_TYPES.find(t => t.id === form.type)?.label}</strong></div>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const renderScratchStep = () => {
    switch (step) {
      case 0: return <StepIdentity form={form} update={update} />;
      case 1: return <StepType form={form} update={update} />;
      case 2: return <StepModel form={form} update={update} />;
      case 3: return <StepPrompt form={form} update={update} />;
      case 4: return <StepTools form={form} toggle={(id: string) => toggleArrayItem("tools", id)} />;
      case 5: return <StepMemory form={form} toggle={(id: string) => toggleArrayItem("memory", id)} />;
      case 6: return <StepKnowledge form={form} toggle={(id: string) => toggleArrayItem("knowledgeBases", id)} />;
      case 7: return <StepDeploy form={form} update={update} />;
      default: return null;
    }
  };

  const isLastStep = step === currentSteps.length - 1;

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => step === 0 ? setMode("choose") : prev()} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">
            {mode === "template" ? "Criar via template" : "Criar do zero"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Passo {step + 1} de {currentSteps.length}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {currentSteps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button key={s.key} onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                isActive ? "bg-primary/15 text-primary" :
                isDone ? "bg-secondary/60 text-foreground cursor-pointer hover:bg-secondary" :
                "text-muted-foreground"
              }`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isDone ? "bg-primary text-primary-foreground" :
                isActive ? "bg-primary/20 text-primary border border-primary/40" :
                "bg-secondary text-muted-foreground"
              }`}>
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
              {i < currentSteps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-1" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
        <div key={`${mode}-${step}`}
        >
          {mode === "template" ? renderTemplateStep() : renderScratchStep()}
        </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button variant="ghost" onClick={() => step === 0 ? setMode("choose") : prev()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="text-xs text-muted-foreground">{step + 1} de {currentSteps.length}</div>
        {!isLastStep ? (
          <Button onClick={next} disabled={!canProceed()} className="gap-2 nexus-gradient-bg text-primary-foreground hover:opacity-90">
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={saveAgent} disabled={saving} className="gap-2 nexus-gradient-bg text-primary-foreground hover:opacity-90">
            {saving ? "Salvando..." : <><Rocket className="h-4 w-4" /> Criar agente</>}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Step Components (scratch mode) ─── */

function StepIdentity({ form, update }: { form: any; update: (k: string, v: unknown) => void }) {
  return (
    <div className="nexus-card space-y-5">
      <h2 className="text-lg font-heading font-semibold text-foreground">Identidade do agente</h2>
      <div className="grid gap-4">
        <div>
          <Label className="text-sm">Nome do agente *</Label>
          <Input value={form.name} onChange={e => update("name", e.target.value)}
            placeholder="Ex: Atlas, Scout, Sentinel..." className="mt-1.5 bg-secondary/50 border-border/50" />
        </div>
        <div>
          <Label className="text-sm">Descrição</Label>
          <Textarea value={form.description} onChange={e => update("description", e.target.value)}
            placeholder="Descreva o propósito deste agente..." rows={3} className="mt-1.5 bg-secondary/50 border-border/50 resize-none" />
        </div>
        <div>
          <Label className="text-sm">Objetivo principal</Label>
          <Input value={form.objective} onChange={e => update("objective", e.target.value)}
            placeholder="Ex: Atender dúvidas técnicas de clientes premium" className="mt-1.5 bg-secondary/50 border-border/50" />
        </div>
      </div>
    </div>
  );
}

function StepType({ form, update }: { form: any; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Tipo do agente</h2>
      <p className="text-sm text-muted-foreground">Selecione o tipo que melhor descreve o papel deste agente.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TYPES.map(t => {
          const Icon = t.icon;
          const selected = form.type === t.id;
          return (
            <button key={t.id} onClick={() => update("type", t.id)}
              className={`nexus-card text-left transition-all ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/60"}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selected ? "bg-primary/20" : "bg-secondary"}`}>
                  <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
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

function StepModel({ form, update }: { form: any; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Modelo base</h2>
      <p className="text-sm text-muted-foreground">Escolha o modelo de linguagem para este agente.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODELS.map(m => {
          const selected = form.model === m.id;
          return (
            <button key={m.id} onClick={() => update("model", m.id)}
              className={`nexus-card text-left transition-all ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/60"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground">{m.name}</span>
                <Badge variant="outline" className="text-[10px]">{m.provider}</Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Custo: <strong className="text-foreground">{m.cost}</strong></span>
                <span>Velocidade: <strong className="text-foreground">{m.speed}</strong></span>
                <span>Qualidade: <strong className="text-foreground">{m.quality}</strong></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPrompt({ form, update }: { form: any; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">System Prompt</h2>
      <p className="text-sm text-muted-foreground">Defina as instruções de comportamento do agente.</p>
      <div className="nexus-card">
        <Textarea value={form.prompt} onChange={e => update("prompt", e.target.value)}
          rows={14} className="bg-secondary/50 border-border/50 font-mono text-xs leading-relaxed resize-none" />
      </div>
    </div>
  );
}

function StepTools({ form, toggle }: { form: any; toggle: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Ferramentas</h2>
      <p className="text-sm text-muted-foreground">Habilite as ferramentas que o agente poderá utilizar.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map(t => {
          const Icon = t.icon;
          const selected = form.tools.includes(t.id);
          return (
            <button key={t.id} onClick={() => toggle(t.id)}
              className={`nexus-card text-left transition-all relative ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/60"}`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${selected ? "bg-primary/20" : "bg-secondary"}`}>
                  <Icon className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.category}</p>
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

function StepMemory({ form, toggle }: { form: any; toggle: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Memória</h2>
      <p className="text-sm text-muted-foreground">Configure as camadas de memória do agente.</p>
      <div className="space-y-3">
        {MEMORY_OPTIONS.map(m => {
          const enabled = form.memory.includes(m.id);
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

function StepKnowledge({ form, toggle }: { form: any; toggle: (id: string) => void }) {
  const kbs = [
    { id: "kb-docs", name: "Documentação Técnica", docs: 342, status: "synced" },
    { id: "kb-faq", name: "FAQ & Suporte", docs: 89, status: "synced" },
    { id: "kb-legal", name: "Políticas & Compliance", docs: 156, status: "syncing" },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Knowledge Base</h2>
      <p className="text-sm text-muted-foreground">Vincule bases de conhecimento para RAG.</p>
      <div className="space-y-3">
        {kbs.map(kb => {
          const selected = form.knowledgeBases.includes(kb.id);
          return (
            <button key={kb.id} onClick={() => toggle(kb.id)}
              className={`nexus-card w-full text-left flex items-center justify-between transition-all ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/60"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selected ? "bg-primary/20" : "bg-secondary"}`}>
                  <Database className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{kb.name}</p>
                  <p className="text-xs text-muted-foreground">{kb.docs} documentos • {kb.status === "synced" ? "Sincronizado" : "Sincronizando..."}</p>
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

function StepDeploy({ form, update }: { form: any; update: (k: string, v: unknown) => void }) {
  const envs = [
    { id: "development", label: "Development", desc: "Testes internos" },
    { id: "staging", label: "Staging", desc: "Validação pré-produção" },
    { id: "production", label: "Production", desc: "Acesso por usuários finais" },
  ];
  const selectedType = AGENT_TYPES.find(t => t.id === form.type);
  const selectedModel = MODELS.find(m => m.id === form.model);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-heading font-semibold text-foreground">Revisão & Deploy</h2>
      <div className="nexus-card space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-muted-foreground">Nome:</span> <strong className="text-foreground ml-1">{form.name || "—"}</strong></div>
          <div><span className="text-muted-foreground">Tipo:</span> <strong className="text-foreground ml-1">{selectedType?.label || "—"}</strong></div>
          <div><span className="text-muted-foreground">Modelo:</span> <strong className="text-foreground ml-1">{selectedModel?.name || "—"}</strong></div>
          <div><span className="text-muted-foreground">Ferramentas:</span> <strong className="text-foreground ml-1">{form.tools.length} selecionadas</strong></div>
          <div><span className="text-muted-foreground">Memória:</span> <strong className="text-foreground ml-1">{form.memory.length} camadas</strong></div>
          <div><span className="text-muted-foreground">Knowledge:</span> <strong className="text-foreground ml-1">{form.knowledgeBases.length} bases</strong></div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {envs.map(e => {
          const selected = form.environment === e.id;
          return (
            <button key={e.id} onClick={() => update("environment", e.id)}
              className={`nexus-card text-left transition-all ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/60"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-2 w-2 rounded-full ${e.id === "production" ? "bg-emerald-500" : e.id === "staging" ? "bg-amber-500" : "bg-muted-foreground"}`} />
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
          <p className="text-xs text-muted-foreground mt-1">Após a criação, configure PII masking, limites de custo e moderação na aba Security.</p>
        </div>
      </div>
    </div>
  );
}
