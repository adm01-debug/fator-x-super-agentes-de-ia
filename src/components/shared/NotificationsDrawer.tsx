import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, AlertTriangle, XCircle, Info, User } from "lucide-react";
import { alerts, activities } from "@/lib/mock-data";

const alertIcons = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const alertColors = {
  error: "text-nexus-rose bg-nexus-rose/10",
  warning: "text-nexus-amber bg-nexus-amber/10",
  info: "text-nexus-cyan bg-nexus-cyan/10",
};

export function NotificationsDrawer() {
  const [open, setOpen] = useState(false);
  const unread = alerts.filter(a => a.type === "error").length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full nexus-gradient-bg flex items-center justify-center text-[9px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <SheetTitle className="text-base font-heading font-bold text-foreground">Notificações</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="alerts" className="flex flex-col h-[calc(100%-60px)]">
          <TabsList className="mx-5 mt-3 bg-secondary/50 border border-border/50">
            <TabsTrigger value="alerts" className="text-xs data-[state=active]:bg-background flex-1">
              Alertas <span className="ml-1.5 text-[10px] text-muted-foreground">({alerts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-background flex-1">
              Atividades <span className="ml-1.5 text-[10px] text-muted-foreground">({activities.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="flex-1 overflow-y-auto px-5 mt-3 space-y-2" aria-live="polite" aria-label="Lista de alertas">
            {alerts.map((alert, i) => {
              const Icon = alertIcons[alert.type];
              const color = alertColors[alert.type];
              return (
                <div key={alert.id}
                  className="rounded-lg border border-border/50 p-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">{alert.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{alert.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                      {alert.agentName && (
                        <span className="inline-block mt-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {alert.agentName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-y-auto px-5 mt-3 space-y-2" aria-live="polite" aria-label="Lista de atividades">
            {activities.map((act, i) => (
              <div key={act.id}
                className="rounded-lg border border-border/50 p-3 hover:bg-secondary/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">
                      <strong>{act.user}</strong>{" "}
                      <span className="text-muted-foreground">{act.action}</span>{" "}
                      <strong>{act.target}</strong>
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">{act.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
