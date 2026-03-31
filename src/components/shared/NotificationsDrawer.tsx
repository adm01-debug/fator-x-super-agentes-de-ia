import { useState, useEffect, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, XCircle, Info, CheckCircle2, FlaskConical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: 'trace' | 'evaluation';
  title: string;
  description?: string;
  level: string;
  created_at: string;
  read: boolean;
}

const alertIcons: Record<string, typeof XCircle> = {
  error: XCircle, critical: XCircle, warning: AlertTriangle, info: Info,
  debug: Info, success: CheckCircle2, evaluation: FlaskConical,
};
const alertColors: Record<string, string> = {
  error: "text-nexus-rose bg-nexus-rose/10",
  critical: "text-nexus-rose bg-nexus-rose/10",
  warning: "text-nexus-amber bg-nexus-amber/10",
  info: "text-nexus-cyan bg-nexus-cyan/10",
  debug: "text-muted-foreground bg-secondary/50",
  success: "text-emerald-400 bg-emerald-400/10",
  evaluation: "text-nexus-violet bg-nexus-violet/10",
};

export function NotificationsDrawer() {
  const [open, setOpen] = useState(false);
  const [realtimeNotifs, setRealtimeNotifs] = useState<Notification[]>([]);
  const queryClient = useQueryClient();

  const { data: dbAlerts = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_traces')
        .select('id, event, level, created_at, metadata')
        .in('level', ['warning', 'error', 'critical'])
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []).map(a => ({
        id: a.id,
        type: 'trace' as const,
        title: a.event,
        level: a.level || 'info',
        created_at: a.created_at,
        read: false,
      }));
    },
    enabled: open,
  });

  // Subscribe to realtime agent failure traces
  useEffect(() => {
    const channel = supabase
      .channel('notifications-traces')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_traces',
          filter: 'level=in.(error,critical,warning)',
        },
        (payload) => {
          const row = payload.new as any;
          const notif: Notification = {
            id: row.id,
            type: 'trace',
            title: row.event,
            level: row.level || 'error',
            created_at: row.created_at,
            read: false,
          };
          setRealtimeNotifs(prev => [notif, ...prev.slice(0, 49)]);
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          // Show toast for errors/critical
          if (row.level === 'error' || row.level === 'critical') {
            toast.error(`⚠️ Falha no agente: ${row.event}`, { duration: 5000 });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Subscribe to agent status changes
  useEffect(() => {
    const channel = supabase
      .channel('notifications-agents')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agents' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (old.status && row.status && old.status !== row.status) {
            const isFailure = row.status === 'deprecated' || row.status === 'archived';
            const isPromotion = row.status === 'production' || row.status === 'monitoring';
            const notif: Notification = {
              id: `agent-status-${row.id}-${Date.now()}`,
              type: 'trace',
              title: `"${row.name}" → ${row.status}`,
              description: `Status alterado de ${old.status} para ${row.status}`,
              level: isFailure ? 'warning' : isPromotion ? 'success' : 'info',
              created_at: new Date().toISOString(),
              read: false,
            };
            setRealtimeNotifs(prev => [notif, ...prev.slice(0, 49)]);
            if (isPromotion) {
              toast.success(`🚀 "${row.name}" está em ${row.status}!`, { duration: 5000 });
            } else if (isFailure) {
              toast.warning(`⚠️ "${row.name}" foi ${row.status}`, { duration: 5000 });
            } else {
              toast.info(`🔄 "${row.name}" → ${row.status}`, { duration: 4000 });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Subscribe to evaluation completions
  useEffect(() => {
    const channel = supabase
      .channel('notifications-evals')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'evaluation_runs' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (old.status !== 'completed' && row.status === 'completed') {
            const notif: Notification = {
              id: `eval-${row.id}`,
              type: 'evaluation',
              title: `Avaliação "${row.name}" concluída`,
              description: row.pass_rate != null ? `Taxa de aprovação: ${(row.pass_rate * 100).toFixed(0)}%` : undefined,
              level: 'evaluation',
              created_at: row.completed_at || new Date().toISOString(),
              read: false,
            };
            setRealtimeNotifs(prev => [notif, ...prev.slice(0, 49)]);
            toast.success(`✅ Avaliação "${row.name}" concluída!`, { duration: 5000 });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evaluation_runs' },
        (payload) => {
          const row = payload.new as any;
          if (row.status === 'completed') {
            const notif: Notification = {
              id: `eval-${row.id}`,
              type: 'evaluation',
              title: `Avaliação "${row.name}" concluída`,
              level: 'evaluation',
              created_at: row.created_at,
              read: false,
            };
            setRealtimeNotifs(prev => [notif, ...prev.slice(0, 49)]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Merge realtime + db alerts, deduplicate by id
  const allNotifs = useCallback(() => {
    const map = new Map<string, Notification>();
    for (const n of [...realtimeNotifs, ...dbAlerts]) {
      if (!map.has(n.id)) map.set(n.id, n);
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);
  }, [realtimeNotifs, dbAlerts]);

  const notifications = allNotifs();
  const unread = notifications.filter(n => !n.read && (n.level === 'error' || n.level === 'critical' || n.type === 'evaluation')).length
    + realtimeNotifs.filter(n => !n.read).length;
  const uniqueUnread = new Set([
    ...notifications.filter(n => !n.read && (n.level === 'error' || n.level === 'critical' || n.type === 'evaluation')).map(n => n.id),
    ...realtimeNotifs.filter(n => !n.read).map(n => n.id),
  ]).size;

  const markAllRead = () => {
    setRealtimeNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) markAllRead(); }}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label={`Notificações${uniqueUnread > 0 ? ` (${uniqueUnread})` : ""}`}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          <AnimatePresence>
            {uniqueUnread > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full nexus-gradient-bg flex items-center justify-center text-[9px] font-bold text-primary-foreground"
              >
                {uniqueUnread > 9 ? '9+' : uniqueUnread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <SheetTitle className="text-base font-heading font-bold text-foreground flex items-center justify-between">
            Notificações
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={markAllRead}>
                Marcar como lidas
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto px-5 mt-3 space-y-2 max-h-[calc(100vh-80px)]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Alertas de agentes e avaliações aparecerão aqui em tempo real</p>
            </div>
          ) : (
            notifications.map((notif, i) => {
              const Icon = alertIcons[notif.level] || Info;
              const color = alertColors[notif.level] || alertColors.info;
              return (
                <motion.div key={notif.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`rounded-lg border border-border/50 p-3 hover:bg-secondary/30 transition-colors cursor-pointer ${!notif.read ? 'bg-secondary/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground truncate">{notif.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {new Date(notif.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {notif.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{notif.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${color}`}>{notif.level}</span>
                        {notif.type === 'evaluation' && (
                          <span className="inline-block text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">avaliação</span>
                        )}
                        {!notif.read && (
                          <span className="h-1.5 w-1.5 rounded-full nexus-gradient-bg" />
                        )}
                      </div>
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
