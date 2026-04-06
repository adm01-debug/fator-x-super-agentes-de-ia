import { useState, useEffect } from "react";
import { Monitor, Smartphone, Clock, Globe, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getActiveSessions, signOutOtherSessions, getAuthUser } from "@/services/securityService";

interface SessionInfo {
  id: string;
  device: string;
  lastActive: string;
  current: boolean;
}

function parseDevice(ua: string): { name: string; isMobile: boolean } {
  if (ua.includes('iPhone') || ua.includes('Android')) {
    if (ua.includes('Chrome')) return { name: 'Chrome / Mobile', isMobile: true };
    if (ua.includes('Safari')) return { name: 'Safari / Mobile', isMobile: true };
    return { name: 'Mobile Browser', isMobile: true };
  }
  if (ua.includes('Firefox')) return { name: 'Firefox / Desktop', isMobile: false };
  if (ua.includes('Edg')) return { name: 'Edge / Desktop', isMobile: false };
  if (ua.includes('Chrome')) return { name: 'Chrome / Desktop', isMobile: false };
  if (ua.includes('Safari')) return { name: 'Safari / Desktop', isMobile: false };
  return { name: 'Unknown Browser', isMobile: false };
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getActiveSessions(), getAuthUser()])
      .then(([sess, user]) => {
        setSessions(sess);
        setUserEmail(user?.email ?? null);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRevokeAll = async () => {
    try {
      await signOutOtherSessions();
      toast.success('Todas as outras sessoes encerradas');
    } catch {
      toast.error('Falha ao encerrar sessoes');
    }
  };

  if (loading) {
    return (
      <div className="nexus-card flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary" /> Sessoes Ativas
        {userEmail && <Badge variant="outline" className="text-[10px] ml-1">{userEmail}</Badge>}
      </h3>
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6 bg-secondary/30 rounded-lg">
            Nenhuma sessao ativa encontrada.
          </div>
        ) : (
          sessions.map(s => {
            const device = parseDevice(s.device);
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30 nexus-row-hover">
                <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                  {device.isMobile ? (
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{device.name}</p>
                    {s.current && <Badge className="text-[10px] bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/20">Atual</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <Globe className="h-3 w-3 inline" /> Sessao ativa • <Clock className="h-3 w-3 inline" /> {new Date(s.lastActive).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {sessions.length > 1 && (
        <Button variant="outline" size="sm" className="mt-3 text-xs text-destructive hover:text-destructive" onClick={handleRevokeAll}>
          Encerrar todas as outras sessoes
        </Button>
      )}
    </div>
  );
}
