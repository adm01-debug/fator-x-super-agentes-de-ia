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
import { supabase } from "@/integrations/supabase/client";

const pages = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home início" },
  { name: "Agents", href: "/agents", icon: Bot, keywords: "agentes bots" },
  { name: "Super Cérebro", href: "/brain", icon: Brain, keywords: "knowledge brain" },
  { name: "Oráculo", href: "/oracle", icon: Sparkles, keywords: "oracle conselho" },
  { name: "Knowledge / RAG", href: "/knowledge", icon: BookOpen, keywords: "documentos rag" },
  { name: "Memory", href: "/memory", icon: Brain, keywords: "memória contexto" },
  { name: "Tools & Integrations", href: "/tools", icon: Puzzle, keywords: "ferramentas api" },
  { name: "Prompts", href: "/prompts", icon: FileText, keywords: "templates prompt" },
  { name: "Workflows", href: "/workflows", icon: GitBranch, keywords: "automação fluxo" },
  { name: "Evaluations", href: "/evaluations", icon: FlaskConical, keywords: "testes avaliação" },
  { name: "Deployments", href: "/deployments", icon: Rocket, keywords: "deploy produção" },
  { name: "Monitoring", href: "/monitoring", icon: Activity, keywords: "monitoramento logs" },
  { name: "Data & Storage", href: "/data-storage", icon: Database, keywords: "dados arquivos" },
  { name: "DataHub", href: "/datahub", icon: ServerCog, keywords: "hub dados externo" },
  { name: "Security & Guardrails", href: "/security", icon: Shield, keywords: "segurança regras" },
  { name: "Team & Roles", href: "/team", icon: Users, keywords: "time equipe" },
  { name: "Billing / Usage", href: "/billing", icon: CreditCard, keywords: "custos uso" },
  { name: "Settings", href: "/settings", icon: Settings, keywords: "configurações" },
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
  } catch { return []; }
}

function addRecent(href: string) {
  try {
    const prev = getRecent().filter(h => h !== href);
    const next = [href, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [recent, setRecent] = useState<string[]>([]);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents_palette'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, model, persona, avatar_emoji, status').order('updated_at', { ascending: false }).limit(10);
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
      // Check if it's an agent link
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
      <CommandInput placeholder="Buscar agentes, páginas, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Recent — only shown when query is empty */}
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

        {agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agentes">
              {agents.map(agent => (
                <CommandItem key={agent.id} onSelect={() => go(`/builder/${agent.id}`)} className="gap-2" keywords={[agent.persona || '', agent.model || '']}>
                  <span className="text-sm" aria-hidden="true">{agent.avatar_emoji || '🤖'}</span>
                  <span>{agent.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{agent.model}</span>
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
