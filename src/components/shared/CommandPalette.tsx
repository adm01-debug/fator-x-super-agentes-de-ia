import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Bot, BookOpen, FileText, Settings, Database, Shield, Users, Activity, Rocket,
  Brain, Puzzle, CreditCard, GitBranch, FlaskConical, LayoutDashboard, Plus,
} from "lucide-react";
import { agents as mockAgents } from "@/lib/mock-data";
import { useAgentBuilderStore } from "@/stores/agentBuilderStore";

const pages = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, group: "Navegação" },
  { name: "Agents", href: "/agents", icon: Bot, group: "Navegação" },
  { name: "Agent Builder", href: "/builder", icon: Rocket, group: "Navegação" },
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
  const savedAgents = useAgentBuilderStore((s) => s.savedAgents);

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

  // Use real agents if available, fallback to mock
  const agentItems = savedAgents.length > 0
    ? savedAgents.map(a => ({
        id: a.id,
        name: a.name,
        emoji: a.avatar_emoji || '🤖',
        subtitle: `${a.persona} • ${a.model}`,
      }))
    : mockAgents.map(a => ({
        id: a.id,
        name: a.name.split("—")[0].trim(),
        emoji: '🤖',
        subtitle: `${a.type} • ${a.model}`,
      }));

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
          {agentItems.map(agent => (
            <CommandItem key={agent.id} onSelect={() => go(`/agents/${agent.id}`)} className="gap-2">
              <span className="text-sm" aria-hidden="true">{agent.emoji}</span>
              <span>{agent.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{agent.subtitle}</span>
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
