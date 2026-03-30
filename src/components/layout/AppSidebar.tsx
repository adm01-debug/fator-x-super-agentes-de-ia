import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Bot, BookOpen, Brain, Puzzle, FileText, GitBranch,
  FlaskConical, Rocket, Activity, Database, Shield, Users, CreditCard, Settings,
  Sparkles, PanelLeftClose, PanelLeft,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navSections = [
  {
    label: "Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Agents", url: "/agents", icon: Bot },
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

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg nexus-gradient-bg" aria-hidden="true">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold text-foreground tracking-tight">Nexus Agents</span>
              <span className="text-[10px] text-muted-foreground">Studio</span>
            </div>
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
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-[11px] font-medium text-foreground">Workspace Free</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">3 de 5 agentes usados</p>
            <div className="mt-2 h-1 rounded-full bg-secondary" role="progressbar" aria-valuenow={60} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de agentes">
              <div className="h-full w-3/5 rounded-full nexus-gradient-bg" />
            </div>
          </div>
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
