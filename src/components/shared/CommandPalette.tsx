import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Bot, BookOpen, FileText, Settings, Database, Shield, Users, Activity, Rocket,
  Brain, Puzzle, CreditCard, GitBranch, FlaskConical, LayoutDashboard, Plus, Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const pages = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, group: "Navegação" },
  { name: "Agents", href: "/agents", icon: Bot, group: "Navegação" },
  { name: "Super Cérebro", href: "/brain", icon: Brain, group: "Navegação" },
  { name: "Oráculo", href: "/oracle", icon: Sparkles, group: "Navegação" },
  { name: "Knowledge / RAG", href: "/knowledge", icon: BookOpen, group: "Navegação" },
  { name: "Memory", href: "/memory", icon: Brain, group: "Navegação" },
  { name: "Tools & Integrations", href: "/tools", icon: Puzzle, group: "Navegação" },
  { name: "Prompts", href: "/prompts", icon: FileText, group: "Navegação" },
  { name: "Workflows", href: "/workflows", icon: GitBranch, group: "Navegação" },
  { name: "Evaluations", href: "/evaluations", icon: FlaskConical, group: "Navegação" },
  { name: "Deployments", href: "/deployments", icon: Rocket, group: "Navegação" },
  { name: "Monitoring", href: "/monitoring", icon: Activity, group: "Navegação" },
  { name: "Data & Storage", href: "/data-storage", icon: Database, group: "Navegação" },
  { name: "Security & Guardrails", href: "/security", icon: Shield, group: "Navegação" },
  { name: "Team & Roles", href: "/team", icon: Users, group: "Navegação" },
  { name: "Billing / Usage", href: "/billing", icon: CreditCard, group: "Navegação" },
  { name: "Settings", href: "/settings", icon: Settings, group: "Navegação" },
];

const quickActions = [
  { name: "Criar novo agente", href: "/agents/new", icon: Plus },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: agents = [] } = useQuery({
    queryKey: ['agents_palette'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, model, persona').order('updated_at', { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: open,
  });

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
    navigate(href);
    setOpen(false);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar agentes, páginas, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Ações rápidas">
          {quickActions.map(a => (
            <CommandItem key={a.name} onSelect={() => go(a.href)} className="gap-2">
              <a.icon className="h-4 w-4 text-primary" />
              <span>{a.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Agentes">
          {agents.map(agent => (
            <CommandItem key={agent.id} onSelect={() => go(`/builder/${agent.id}`)} className="gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span>{agent.name}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{agent.persona} • {agent.model}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegação">
          {pages.map(p => (
            <CommandItem key={p.href} onSelect={() => go(p.href)} className="gap-2">
              <p.icon className="h-4 w-4 text-muted-foreground" />
              <span>{p.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
