import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, Command } from "lucide-react";
import { NotificationsDrawer } from "@/components/shared/NotificationsDrawer";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { DirectionalTransition } from "@/components/shared/DirectionalTransition";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { UnsavedChangesProvider } from "@/hooks/use-unsaved-changes";

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
        {/* Skip to content link — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Pular para o conteúdo
        </a>

        <div className="min-h-screen flex w-full">
          <AppSidebar />
           <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b border-border/50 px-3 sm:px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30" role="banner">
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" aria-label="Alternar sidebar" />
                <button
                  onClick={() => setCmdOpen(true)}
                  className="hidden md:flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground cursor-pointer hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  aria-label="Abrir busca rápida (⌘K)"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buscar...</span>
                  <kbd className="ml-4 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground" aria-hidden="true">
                    <Command className="h-2.5 w-2.5" />K
                  </kbd>
                </button>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ThemeToggle />
                <NotificationsDrawer />
                <button
                  className="h-8 w-8 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Menu do usuário"
                >
                  MC
                </button>
              </div>
            </header>
            <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
              <ErrorBoundary>
                <DirectionalTransition>
                  {children}
                </DirectionalTransition>
              </ErrorBoundary>
            </main>
          </div>
        </div>
        <CommandPalette />
      </SidebarProvider>
    </UnsavedChangesProvider>
  );
}
