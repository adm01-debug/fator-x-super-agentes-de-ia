import { logger } from '@/lib/logger';
import { useLocation, useNavigate } from "react-router-dom";
import fatorxIcon from "@/assets/fatorx-icon.png";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Bot, BookOpen, Brain, Puzzle, FileText, GitBranch, Zap,
  FlaskConical, Rocket, Activity, Database, Shield, Users, CreditCard, Settings,
  Sparkles, PanelLeftClose, PanelLeft, LogOut, ServerCog, ChevronDown, Palette, Dna, Workflow, Package,
  Globe, ShieldCheck, CircleCheckBig, Crown, Route as RouteIcon, Languages,
  Mic, GitBranch as GitBranchIcon, KeyRound, Globe2, Monitor, Eye, Smartphone, TestTube2,
  Store, Cpu, Wand2, GitMerge, Terminal, Mail, Bug, FileCheck2,
  PhoneCall, Network, FlaskRound, TrendingDown,
  Share2, Building2, Radar, ShieldAlert,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { getWorkspaceInfo } from "@/lib/agentService";
import { useI18n } from "@/hooks/useI18n";

const navSections = [
  {
    label: "Geral",
    key: "geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Agentes", url: "/agents", icon: Bot },
      { title: "Super Cérebro", url: "/brain", icon: Brain },
      { title: "Oráculo", url: "/oracle", icon: Sparkles },
      { title: "AI Studio", url: "/ai-studio", icon: Palette },
    ],
  },
  {
    label: "Desenvolvimento",
    key: "dev",
    items: [
      { title: "Conhecimento / RAG", url: "/knowledge", icon: BookOpen },
      { title: "Memória", url: "/memory", icon: Brain },
      { title: "Ferramentas", url: "/tools", icon: Puzzle },
      { title: "Prompts", url: "/prompts", icon: FileText },
      { title: "Workflows", url: "/workflows", icon: GitBranch },
      { title: "Automação", url: "/automation", icon: Zap },
      { title: "Roteamento", url: "/routing", icon: RouteIcon },
      { title: "Fine-tuning", url: "/fine-tuning", icon: Dna },
      { title: "Smolagent", url: "/smolagent", icon: Workflow },
      { title: "Skills Marketplace", url: "/skills", icon: Package },
      { title: "NLP Pipeline", url: "/nlp", icon: Languages },
      { title: "Computer Use", url: "/computer-use", icon: Monitor },
      { title: "Browser Agent", url: "/browser-agent", icon: Globe2 },
      { title: "Vision Agents", url: "/vision", icon: Eye },
      { title: "Mobile SDK", url: "/mobile-sdk", icon: Smartphone },
      { title: "A/B Test Prompts", url: "/ab-test", icon: TestTube2 },
      { title: "Marketplace Pro", url: "/marketplace-pro", icon: Store },
      { title: "Fine-Tuning", url: "/fine-tuning", icon: Cpu },
      { title: "Synthetic Data", url: "/synthetic-data", icon: Wand2 },
      { title: "Canary Deploys", url: "/canary", icon: GitMerge },
      { title: "Code Interpreter", url: "/code-interpreter", icon: Terminal },
      { title: "Email Triggers", url: "/email-triggers", icon: Mail },
      { title: "Agent Debugger", url: "/debugger", icon: Bug },
      { title: "Compliance Reports", url: "/compliance-reports", icon: FileCheck2 },
      { title: "Voice & Telefonia", url: "/voice-telephony", icon: PhoneCall },
      { title: "Knowledge Graph", url: "/knowledge-graph", icon: Network },
      { title: "Simulation Lab", url: "/simulation", icon: FlaskRound },
      { title: "Cost Optimizer", url: "/cost-optimizer", icon: TrendingDown },
      { title: "Federated Learning", url: "/federated-learning", icon: Share2 },
      { title: "Multi-Tenancy", url: "/multi-tenancy", icon: Building2 },
      { title: "Observability", url: "/observability", icon: Radar },
      { title: "Disaster Recovery", url: "/disaster-recovery", icon: ShieldAlert },
    ],
  },
  {
    label: "Operações",
    key: "ops",
    items: [
      { title: "Avaliações", url: "/evaluations", icon: FlaskConical },
      { title: "Implantações", url: "/deployments", icon: Rocket },
      { title: "Monitoramento", url: "/monitoring", icon: Activity },
      { title: "Traces & Spans", url: "/traces", icon: Activity },
      { title: "Replay & Fork", url: "/replay", icon: GitBranchIcon },
      { title: "Voice Agent", url: "/voice", icon: Mic },
      { title: "Voice Realtime", url: "/voice-agents", icon: Mic },
      { title: "Dados & Storage", url: "/data-storage", icon: Database },
      { title: "DataHub", url: "/datahub", icon: ServerCog },
    ],
  },
  {
    label: "Administração",
    key: "admin",
    items: [
      { title: "Segurança", url: "/security", icon: Shield },
      { title: "SSO Enterprise", url: "/sso", icon: KeyRound },
      { title: "Data Residency", url: "/residency", icon: Globe2 },
      { title: "LGPD", url: "/lgpd", icon: ShieldCheck },
      { title: "Aprovações", url: "/approvals", icon: CircleCheckBig },
      { title: "Equipe", url: "/team", icon: Users },
      { title: "Faturamento", url: "/billing", icon: CreditCard },
      { title: "Configurações", url: "/settings", icon: Settings },
      { title: "Admin BD", url: "/admin", icon: ServerCog },
    ],
  },
];

const COLLAPSED_KEY = "nexus-sidebar-sections";

function getInitialCollapsed(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) { logger.error("Operation failed:", err);}
  // Default: only "Geral" expanded
  return { geral: false, dev: false, ops: true, admin: true };
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { locale, setLocale } = useI18n();
  const [wsInfo, setWsInfo] = useState<{ name: string; plan: string; maxAgents: number; agentCount: number; userName: string; email: string } | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(getInitialCollapsed);

  // Auto-expand the section containing the active route
  useEffect(() => {
    setSectionCollapsed(prev => {
      for (const section of navSections) {
        const hasActive = section.items.some(item =>
          item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
        );
        if (hasActive && prev[section.key]) {
          const next = { ...prev, [section.key]: false };
          try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch (err) { logger.error("Operation failed:", err); /* noop */ }
          return next;
        }
      }
      return prev;
    });
  }, [location.pathname]);

  const toggleSection = useCallback((key: string) => {
    setSectionCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch (err) { logger.error("Operation failed:", err);}
      return next;
    });
  }, []);

  useEffect(() => {
    if (user) {
      getWorkspaceInfo().then(info => info && setWsInfo(info));
    }
  }, [user]);

  const planLabel = wsInfo?.plan === 'pro' ? 'Pro' : wsInfo?.plan === 'enterprise' ? 'Enterprise' : 'Free';
  const agentCount = wsInfo?.agentCount ?? 0;
  const maxAgents = wsInfo?.maxAgents ?? 5;
  const usage = maxAgents > 0 ? Math.min((agentCount / maxAgents) * 100, 100) : 0;

  const badgeCounts: Record<string, number> = {
    '/agents': agentCount,
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/30 bg-sidebar" aria-label="Navegação principal">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5">
          <img src={fatorxIcon} alt="" className="h-8 w-8 shrink-0 rounded-lg shadow-sm shadow-primary/20" />
          {!collapsed && (
            <span className="font-heading text-base font-extrabold tracking-tight" aria-label="Fator X">
              <span className="text-foreground">FATOR</span>
              <span className="text-primary ml-0.5">X</span>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2" role="navigation" aria-label="Menu principal">
        {navSections.map((section, sectionIdx) => {
          const isCollapsedSection = sectionCollapsed[section.key] && !collapsed;
          return (
            <SidebarGroup key={section.label}>
              {!collapsed ? (
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex items-center justify-between w-full px-2.5 mb-1 group/label hover:bg-secondary/30 rounded-md py-1 transition-colors"
                  aria-expanded={!isCollapsedSection}
                  aria-controls={`nav-section-${section.key}`}
                >
                  <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/80 pointer-events-none p-0 h-auto font-semibold">
                    {section.label}
                  </SidebarGroupLabel>
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground/50 transition-transform duration-200 ${isCollapsedSection ? '-rotate-90' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                sectionIdx > 0 && <Separator className="my-1.5 mx-auto w-6 bg-border/40" />
              )}
              <SidebarGroupContent
                id={`nav-section-${section.key}`}
                className={`transition-all duration-200 overflow-hidden ${isCollapsedSection ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}
              >
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive = item.url === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                          <NavLink
                            to={item.url}
                            end={item.url === "/"}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-200 group/navitem ${
                              isActive
                                ? 'text-primary font-semibold bg-primary/12'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5 hover:shadow-sm'
                            }`}
                            activeClassName=""
                            aria-current={isActive ? "page" : undefined}
                          >
                            <item.icon className={`h-4 w-4 shrink-0 transition-all duration-200 group-hover/navitem:scale-110 ${isActive ? 'text-primary' : ''}`} />
                            {!collapsed && <span className="transition-colors duration-150">{item.title}</span>}
                            {!collapsed && badgeCounts[item.url] > 0 && (
                              <span className="ml-auto text-[10px] font-semibold bg-primary/15 text-primary rounded-full px-1.5 py-0.5 tabular-nums leading-none">
                                {badgeCounts[item.url]}
                              </span>
                            )}
                            {isActive && !collapsed && !badgeCounts[item.url] && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-glow-pulse nexus-pulse-ring" />
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-1.5">
        {!collapsed && (
          <>
            <Separator className="bg-border/30" />
            <div className="rounded-lg bg-secondary/40 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-foreground">Workspace {planLabel}</p>
                <span className="text-[11px] text-muted-foreground">{agentCount}/{maxAgents}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary" role="progressbar" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de agentes">
                <div className={`h-full rounded-full transition-all duration-500 ${usage >= 100 ? 'bg-nexus-amber' : 'nexus-gradient-bg'}`} style={{ width: `${Math.max(usage, 4)}%` }} />
              </div>
              {usage >= 80 && planLabel === 'Free' && (
                <button
                  onClick={() => navigate('/billing')}
                  className="flex items-center gap-1.5 mt-2 w-full justify-center rounded-md bg-gradient-to-r from-nexus-amber/20 to-nexus-amber/10 border border-nexus-amber/30 px-2 py-1.5 text-[11px] font-semibold text-nexus-amber hover:from-nexus-amber/30 hover:to-nexus-amber/20 transition-all"
                >
                  <Crown className="h-3 w-3" />
                  {usage >= 100 ? 'Limite atingido — Fazer upgrade' : 'Quase no limite — Upgrade'}
                </button>
              )}
            </div>
            <Separator className="bg-border/30" />
            {user && (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="h-7 w-7 rounded-full shrink-0 object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-7 w-7 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                    {(wsInfo?.userName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{wsInfo?.userName || 'Usuário'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={signOut} aria-label="Sair da conta">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] text-muted-foreground/50 select-none">Fator X v1.0</p>
              <button
                onClick={() => setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR')}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-secondary/50"
                title="Alternar idioma"
              >
                <Globe className="h-3 w-3" />
                {locale === 'pt-BR' ? 'PT' : 'EN'}
              </button>
            </div>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs h-8"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
