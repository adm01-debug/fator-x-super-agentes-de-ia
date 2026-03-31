import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, XCircle, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const alertIcons: Record<string, typeof XCircle> = {
  error: XCircle, critical: XCircle, warning: AlertTriangle, info: Info, debug: Info,
};
const alertColors: Record<string, string> = {
  error: "text-nexus-rose bg-nexus-rose/10",
  critical: "text-nexus-rose bg-nexus-rose/10",
  warning: "text-nexus-amber bg-nexus-amber/10",
  info: "text-nexus-cyan bg-nexus-cyan/10",
  debug: "text-muted-foreground bg-secondary/50",
};

export function NotificationsDrawer() {
  const [open, setOpen] = useState(false);

  const { data: alerts = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_traces')
        .select('id, event, level, created_at, metadata')
        .in('level', ['warning', 'error', 'critical'])
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: open,
  });

  const unread = alerts.filter(a => a.level === 'error' || a.level === 'critical').length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label={`Notificações${unread > 0 ? ` (${unread})` : ""}`}>
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

        <div className="overflow-y-auto px-5 mt-3 space-y-2 max-h-[calc(100vh-80px)]">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            alerts.map((alert, i) => {
              const level = alert.level || 'info';
              const Icon = alertIcons[level] || Info;
              const color = alertColors[level] || alertColors.info;
              return (
                <motion.div key={alert.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-border/50 p-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">{alert.event}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {new Date(alert.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{level}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
