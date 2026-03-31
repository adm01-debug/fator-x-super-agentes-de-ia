import { useLocation } from "react-router-dom";
import fatorxIcon from "@/assets/fatorx-icon.png";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Bot, BookOpen, Brain, Puzzle, FileText, GitBranch,
  FlaskConical, Rocket, Activity, Database, Shield, Users, CreditCard, Settings,
  Sparkles, PanelLeftClose, PanelLeft, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getWorkspaceInfo } from "@/lib/agentService";

const navSections = [
  {
    label: "Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Agents", url: "/agents", icon: Bot },
      { title: "Super Cérebro", url: "/brain", icon: Brain },
      { title: "Oráculo", url: "/oracle", icon: Sparkles },
    ],
  },
  {
    label: "Desenvolvimento",
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
    items: [
      { title: "Evaluations", url: "/evaluations", icon: FlaskConical },
      { title: "Deployments", url: "/deployments", icon: Rocket },
      { title: "Monitoring", url: "/monitoring", icon: Activity },
      { title: "Data & Storage", url: "/data-storage", icon: Database },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Security & Guardrails", url: "/security", icon: Shield },
      { title: "Team & Roles", url: "/team", icon: Users },
      { title: "Billing / Usage", url: "/billing", icon: CreditCard },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [wsInfo, setWsInfo] = useState<{ name: string; plan: string; maxAgents: number; agentCount: number; userName: string; email: string } | null>(null);

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
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-1.5">
          <img src={fatorxIcon} alt="Fator X" className="h-14 w-14 shrink-0 rounded-xl" />
          {!collapsed && (
            <span className="font-heading text-lg font-extrabold tracking-tight">
              <span className="text-muted-foreground">FATOR</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexus-cyan to-nexus-teal ml-0.5">X</span>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navSections.map((section, sectionIdx) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2.5 mb-1">
                {section.label}
              </SidebarGroupLabel>
            )}
            {collapsed && sectionIdx > 0 && (
              <Separator className="my-1.5 mx-auto w-6 bg-border/40" />
            )}
            <SidebarGroupContent>
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
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {!collapsed && (
          <>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[11px] font-medium text-foreground">Workspace {planLabel}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{agentCount} de {maxAgents} agentes usados</p>
              <div className="mt-2 h-1 rounded-full bg-secondary" role="progressbar" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de agentes">
                <div className="h-full rounded-full nexus-gradient-bg transition-all" style={{ width: `${usage}%` }} />
              </div>
            </div>
            {user && (
              <div className="rounded-lg bg-secondary/30 p-2.5 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(wsInfo?.userName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{wsInfo?.userName || 'Usuário'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={signOut} title="Sair">
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
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
