import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, Bell, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { CommandPalette } from "@/components/shared/CommandPalette";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/50 px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <button
                onClick={() => setCmdOpen(true)}
                className="hidden md:flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground cursor-pointer hover:bg-secondary transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar...</span>
                <kbd className="ml-4 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full nexus-gradient-bg" />
              </Button>
              <div className="h-8 w-8 rounded-full nexus-gradient-bg flex items-center justify-center text-xs font-semibold text-primary-foreground">
                MC
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
