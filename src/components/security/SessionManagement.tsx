import { useState, useEffect } from "react";
import { Monitor, Smartphone, Clock, Globe, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getActiveSessions, signOutOtherSessions, getAuthUser } from "@/services/securityService";

function parseDevice(ua: string) {
  if (ua.includes('iPhone') || ua.includes('Android')) return { name: ua.includes('Chrome') ? 'Chrome / Mobile' : 'Safari / Mobile', mobile: true };
  if (ua.includes('Firefox')) return { name: 'Firefox / Desktop', mobile: false };
  if (ua.includes('Edg')) return { name: 'Edge / Desktop', mobile: false };
  if (ua.includes('Chrome')) return { name: 'Chrome / Desktop', mobile: false };
  return { name: 'Browser', mobile: false };
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; lastActive: string; current: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getActiveSessions(), getAuthUser()])
      .then(([s, u]) => { setSessions(s); setEmail(u?.email ?? null); })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="nexus-card flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary" /> Sessões Ativas
        {email && <Badge variant="outline" className="text-[10px] ml-1">{email}</Badge>}
      </h3>
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma sessão ativa</p>
        ) : sessions.map(s => {
          const d = parseDevice(s.device);
          return (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30 nexus-row-hover">
              <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                {d.mobile ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Monitor className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground">{d.name}</p>
                  {s.current && <Badge className="text-[10px] bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/20">Atual</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <Globe className="h-3 w-3 inline" /> Sessão ativa • <Clock className="h-3 w-3 inline" /> {new Date(s.lastActive).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {sessions.length > 1 && (
        <Button variant="outline" size="sm" className="mt-3 text-xs text-destructive" onClick={() => signOutOtherSessions().then(() => toast.success('Outras sessões encerradas')).catch(() => toast.error('Falha'))}>
          Encerrar todas as outras sessões
        </Button>
      )}
    </div>
  );
}
