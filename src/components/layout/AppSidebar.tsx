import { useLocation } from "react-router-dom";
import fatorxIcon from "@/assets/fatorx-icon.png";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Bot, BookOpen, Brain, Puzzle, FileText, GitBranch,
  FlaskConical, Rocket, Activity, Database, Shield, Users, CreditCard, Settings,
  Sparkles, PanelLeftClose, PanelLeft, LogOut, ServerCog, ChevronDown,
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

const navSections = [
  {
    label: "Geral",
    key: "geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Agents", url: "/agents", icon: Bot },
      { title: "Super Cérebro", url: "/brain", icon: Brain },
      { title: "Oráculo", url: "/oracle", icon: Sparkles },
    ],
  },
  {
    label: "Desenvolvimento",
    key: "dev",
    items: [
      { title: "Knowledge / RAG", url: "/knowledge", icon: BookOpen },
      { title: "Memory", url: "/memory", icon: Brain },
      { title: "Tools & Integrations", url: "/tools", icon: Puzzle },
      { title: "Prompts", url: "/prompts", icon: FileText },
      { title: "Workflows", url: "/workflows", icon: GitBranch },
    ],
  },
  {
    label: "Operações",
    key: "ops",
    items: [
      { title: "Evaluations", url: "/evaluations", icon: FlaskConical },
      { title: "Deployments", url: "/deployments", icon: Rocket },
      { title: "Monitoring", url: "/monitoring", icon: Activity },
      { title: "Data & Storage", url: "/data-storage", icon: Database },
      { title: "DataHub", url: "/datahub", icon: ServerCog },
    ],
  },
  {
    label: "Administração",
    key: "admin",
    items: [
      { title: "Security & Guardrails", url: "/security", icon: Shield },
      { title: "LGPD Compliance", url: "/lgpd", icon: Shield },
      { title: "Aprovações (HITL)", url: "/approvals", icon: Shield },
      { title: "Team & Roles", url: "/team", icon: Users },
      { title: "Billing / Usage", url: "/billing", icon: CreditCard },
      { title: "Settings", url: "/settings", icon: Settings },
      { title: "Admin BD", url: "/admin", icon: ServerCog },
    ],
  },
];

const COLLAPSED_KEY = "nexus-sidebar-sections";

function getInitialCollapsed(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // Default: only "Geral" expanded
  return { geral: false, dev: true, ops: true, admin: true };
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [wsInfo, setWsInfo] = useState<{ name: string; plan: string; maxAgents: number; agentCount: number; userName: string; email: string } | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(getInitialCollapsed);

  // Auto-expand the section containing the active route
  useEffect(() => {
    for (const section of navSections) {
      const hasActive = section.items.some(item =>
        item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
      );
      if (hasActive && sectionCollapsed[section.key]) {
        setSectionCollapsed(prev => {
          const next = { ...prev, [section.key]: false };
          try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
        break;
      }
    }
  }, [location.pathname]);

  const toggleSection = useCallback((key: string) => {
    setSectionCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch {}
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

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50" aria-label="Navegação principal">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <img src={fatorxIcon} alt="" className="h-8 w-8 shrink-0 rounded-lg" fetchPriority="high" />
          {!collapsed && (
            <span className="font-heading text-base font-extrabold tracking-tight" aria-label="Fator X">
              <span className="text-foreground">FATOR</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexus-cyan to-nexus-teal ml-0.5">X</span>
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
                  <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 pointer-events-none p-0 h-auto">
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
                            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            activeClassName="bg-primary/10 text-primary font-medium"
                            aria-current={isActive ? "page" : undefined}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
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
              <div className="h-1 rounded-full bg-secondary" role="progressbar" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de agentes">
                <div className="h-full rounded-full nexus-gradient-bg transition-all" style={{ width: `${usage}%` }} />
              </div>
            </div>
            <Separator className="bg-border/30" />
            {user && (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors">
                <div className="h-7 w-7 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                  {(wsInfo?.userName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{wsInfo?.userName || 'Usuário'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={signOut} aria-label="Sair da conta">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
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
