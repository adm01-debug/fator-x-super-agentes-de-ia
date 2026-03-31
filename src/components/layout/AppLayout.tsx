import { lazy, Suspense, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { DirectionalTransition } from "@/components/shared/DirectionalTransition";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { UnsavedChangesProvider } from "@/hooks/use-unsaved-changes";

// Lazy load — só carregam quando o usuário abre
const NotificationsDrawer = lazy(() => import("@/components/shared/NotificationsDrawer").then(m => ({ default: m.NotificationsDrawer })));
const CommandPalette = lazy(() => import("@/components/shared/CommandPalette").then(m => ({ default: m.CommandPalette })));

interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "nexus-sidebar-state";

function getDefaultOpen() {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored !== "false";
  } catch {
    return true;
  }
}

export function AppLayout({ children }: AppLayoutProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [defaultOpen] = useState(getDefaultOpen);

  return (
    <UnsavedChangesProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        onOpenChange={(open) => {
          try { localStorage.setItem(SIDEBAR_KEY, String(open)); } catch {}
        }}
      >
        <div className="min-h-screen flex w-full">
          <AppSidebar />
           <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b border-border/50 px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30" role="banner">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" aria-label="Alternar sidebar" />
                <button
                  onClick={() => setCmdOpen(true)}
                  className="hidden md:flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground cursor-pointer hover:bg-secondary transition-colors"
                  aria-label="Abrir busca rápida (⌘K)"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buscar...</span>
                  <kbd className="ml-4 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground" aria-hidden="true">
                    <Command className="h-2.5 w-2.5" />K
                  </kbd>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Suspense fallback={null}><NotificationsDrawer /></Suspense>
                <button
                  className="h-8 w-8 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Menu do usuário MC"
                >
                  MC
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <ErrorBoundary>
                <DirectionalTransition>
                  {children}
                </DirectionalTransition>
              </ErrorBoundary>
            </main>
          </div>
        </div>
        <Suspense fallback={null}><CommandPalette /></Suspense>
      </SidebarProvider>
    </UnsavedChangesProvider>
  );
}
