import { logger } from '@/lib/logger';
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Bot, BookOpen, FileText, Settings, Database, Shield, Users, Activity, Rocket,
  Brain, Puzzle, CreditCard, GitBranch, FlaskConical, LayoutDashboard, Plus, Sparkles,
  Clock, ArrowRight, ServerCog,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { Loader2, Bot as BotIcon, BookOpen as KbIcon, FileText as ArticleIcon, GitBranch as WfIcon, FlaskConical as EvalIcon, Zap as AutoIcon, FileText as DocIcon } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  agent: { label: "Agente", icon: BotIcon, color: "text-primary" },
  knowledge_base: { label: "Base", icon: KbIcon, color: "text-nexus-emerald" },
  article: { label: "Artigo", icon: ArticleIcon, color: "text-nexus-cyan" },
  workflow: { label: "Workflow", icon: WfIcon, color: "text-nexus-cyan" },
  eval_dataset: { label: "Avaliação", icon: EvalIcon, color: "text-nexus-amber" },
  automation: { label: "Automação", icon: AutoIcon, color: "text-nexus-amber" },
  document: { label: "Documento", icon: DocIcon, color: "text-muted-foreground" },
};

const pages = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home início" },
  { name: "Agentes", href: "/agents", icon: Bot, keywords: "agents bots" },
  { name: "Super Cérebro", href: "/brain", icon: Brain, keywords: "knowledge brain" },
  { name: "Oráculo", href: "/oracle", icon: Sparkles, keywords: "oracle conselho" },
  { name: "Conhecimento / RAG", href: "/knowledge", icon: BookOpen, keywords: "documentos rag knowledge" },
  { name: "Memória", href: "/memory", icon: Brain, keywords: "memory contexto" },
  { name: "Ferramentas", href: "/tools", icon: Puzzle, keywords: "tools api integrations" },
  { name: "Prompts", href: "/prompts", icon: FileText, keywords: "templates prompt" },
  { name: "Workflows", href: "/workflows", icon: GitBranch, keywords: "automação fluxo" },
  { name: "Avaliações", href: "/evaluations", icon: FlaskConical, keywords: "testes avaliação evaluations" },
  { name: "Implantações", href: "/deployments", icon: Rocket, keywords: "deploy produção deployments" },
  { name: "Monitoramento", href: "/monitoring", icon: Activity, keywords: "monitoring logs" },
  { name: "Dados & Storage", href: "/data-storage", icon: Database, keywords: "dados arquivos" },
  { name: "DataHub", href: "/datahub", icon: ServerCog, keywords: "hub dados externo" },
  { name: "Segurança", href: "/security", icon: Shield, keywords: "security guardrails regras" },
  { name: "Equipe", href: "/team", icon: Users, keywords: "time team roles" },
  { name: "Faturamento", href: "/billing", icon: CreditCard, keywords: "custos uso billing" },
  { name: "Configurações", href: "/settings", icon: Settings, keywords: "settings" },
];

const quickActions = [
  { name: "Criar novo agente", href: "/agents/new", icon: Plus, keywords: "novo criar" },
  { name: "Consultar Super Cérebro", href: "/brain", icon: Brain, keywords: "perguntar cérebro" },
  { name: "Abrir Oráculo", href: "/oracle", icon: Sparkles, keywords: "oracle conselho" },
];

const RECENT_KEY = "nexus-cmd-recent";
const MAX_RECENT = 5;

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch (err) { logger.error("Operation failed:", err); return []; }
}

function addRecent(href: string) {
  try {
    const prev = getRecent().filter(h => h !== href);
    const next = [href, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (err) { logger.error("Operation failed:", err);}
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [recent, setRecent] = useState<string[]>([]);

  const { data: globalHits = [], isFetching: isSearching } = useGlobalSearch(search, open);

  // ═══ Fetch agents ═══
  const { data: agents = [] } = useQuery({
    queryKey: ['agents_palette'],
    queryFn: async () => {
      const { data } = await supabaseExternal.from('agents').select('id, name, model, persona, avatar_emoji, status').order('updated_at', { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: open,
  });

  // ═══ Fetch knowledge bases ═══
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ['kb_palette'],
    queryFn: async () => {
      const { data } = await supabaseExternal.from('knowledge_bases').select('id, name, document_count, status').order('updated_at', { ascending: false }).limit(8);
      return data ?? [];
    },
    enabled: open,
  });

  // ═══ Fetch workflows ═══
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows_palette'],
    queryFn: async () => {
      const { data } = await supabaseExternal.from('workflows').select('id, name, status').order('updated_at', { ascending: false }).limit(8);
      return data ?? [];
    },
    enabled: open,
  });

  // ═══ Fetch tools ═══
  const { data: tools = [] } = useQuery({
    queryKey: ['tools_palette'],
    queryFn: async () => {
      const { data } = await supabaseExternal.from('tool_integrations').select('id, name, type, is_enabled').order('name').limit(8);
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) setRecent(getRecent());
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback((href: string) => {
    addRecent(href);
    navigate(href);
    setOpen(false);
  }, [navigate]);

  // Build recent items
  const recentItems = recent
    .filter(href => href !== location.pathname)
    .map(href => {
      const page = pages.find(p => p.href === href);
      if (page) return { ...page, type: 'page' as const };
      if (href.startsWith('/builder/')) {
        const agentId = href.replace('/builder/', '');
        const agent = agents.find(a => a.id === agentId);
        return agent
          ? { name: agent.name, href, icon: Bot, keywords: '', type: 'agent' as const }
          : null;
      }
      return null;
    })
    .filter(Boolean) as Array<{ name: string; href: string; icon: React.ElementType; type: string }>;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar agentes, bases de conhecimento, workflows, páginas..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Recent */}
        {recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recentItems.map(item => (
                <CommandItem key={item.href} onSelect={() => go(item.href)} className="gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.name}</span>
                  <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/30" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Ações rápidas">
          {quickActions.map(a => (
            <CommandItem key={a.name} onSelect={() => go(a.href)} className="gap-2" keywords={[a.keywords]}>
              <a.icon className="h-4 w-4 text-primary" />
              <span className="font-medium">{a.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Agents */}
        {agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agentes">
              {agents.map(agent => (
                <CommandItem key={agent.id} onSelect={() => go(`/builder/${agent.id}`)} className="gap-2" keywords={[agent.persona || '', agent.model || '', agent.name]}>
                  <span className="text-sm" aria-hidden="true">{agent.avatar_emoji || '🤖'}</span>
                  <span>{agent.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{agent.model}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Knowledge Bases */}
        {knowledgeBases.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Bases de Conhecimento">
              {knowledgeBases.map(kb => (
                <CommandItem key={kb.id} onSelect={() => go('/knowledge')} className="gap-2" keywords={[kb.name, 'rag', 'documento', 'knowledge']}>
                  <BookOpen className="h-4 w-4 text-nexus-emerald" />
                  <span>{kb.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{kb.document_count ?? 0} docs</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Workflows */}
        {workflows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workflows">
              {workflows.map(wf => (
                <CommandItem key={wf.id} onSelect={() => go('/workflows')} className="gap-2" keywords={[wf.name, 'automação', 'fluxo', 'workflow']}>
                  <GitBranch className="h-4 w-4 text-nexus-cyan" />
                  <span>{wf.name}</span>
                  <span className={`ml-auto text-[11px] ${wf.status === 'active' ? 'text-nexus-emerald' : 'text-muted-foreground'}`}>{wf.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Tools */}
        {tools.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ferramentas">
              {tools.map(tool => (
                <CommandItem key={tool.id} onSelect={() => go('/tools')} className="gap-2" keywords={[tool.name, tool.type, 'ferramenta', 'integração']}>
                  <Puzzle className="h-4 w-4 text-nexus-amber" />
                  <span>{tool.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{tool.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navegação">
          {pages.map(p => (
            <CommandItem key={p.href} onSelect={() => go(p.href)} className="gap-2" keywords={[p.keywords]}>
              <p.icon className="h-4 w-4 text-muted-foreground" />
              <span>{p.name}</span>
              {p.href === location.pathname && (
                <span className="ml-auto text-[11px] text-primary font-medium">atual</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
