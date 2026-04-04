import { Monitor, Smartphone, Clock, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const sessions = [
  { id: '1', device: 'Chrome / macOS', ip: '187.45.xxx.xx', location: 'São Paulo, BR', lastActive: new Date(), current: true },
  { id: '2', device: 'Safari / iPhone', ip: '187.45.xxx.xx', location: 'São Paulo, BR', lastActive: new Date(Date.now() - 3600000), current: false },
  { id: '3', device: 'Firefox / Windows', ip: '201.17.xxx.xx', location: 'Rio de Janeiro, BR', lastActive: new Date(Date.now() - 86400000), current: false },
];

export function SessionManagement() {
  const handleRevoke = (_id: string) => {
    toast.success('Sessão encerrada com sucesso');
  };

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary" /> Sessões Ativas
      </h3>
      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30 nexus-row-hover">
            <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
              {s.device.includes('iPhone') || s.device.includes('Android') ? (
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Monitor className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">{s.device}</p>
                {s.current && <Badge className="text-[10px] bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/20">Atual</Badge>}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Globe className="h-3 w-3 inline" /> {s.location} • <Clock className="h-3 w-3 inline" /> {s.lastActive.toLocaleString('pt-BR')}
              </p>
            </div>
            {!s.current && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRevoke(s.id)}>
                Encerrar
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-3 text-xs text-destructive hover:text-destructive" onClick={() => toast.success('Todas as outras sessões encerradas')}>
        Encerrar todas as outras sessões
      </Button>
    </div>
  );
}
