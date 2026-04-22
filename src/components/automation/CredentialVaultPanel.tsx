import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, ShieldCheck, AlertTriangle, RotateCcw, Key } from 'lucide-react';
import {
  listCredentials,
  getVaultStats,
  CREDENTIAL_TEMPLATES,
  type VaultStats,
} from '@/services/credentialVaultService';
import { useToast } from '@/hooks/use-toast';

const TYPE_ICONS: Record<string, string> = {
  api_key: '🔑',
  oauth2: '🔐',
  basic_auth: '👤',
  bearer_token: '🎫',
  ssh_key: '🖥️',
  database: '🗄️',
  smtp: '📧',
  webhook_secret: '🔗',
  custom: '⚙️',
};

export function CredentialVaultPanel() {
  const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof listCredentials>>>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([listCredentials(), getVaultStats()])
      .then(([c, s]) => {
        setCredentials(c);
        setStats(s);
      })
      .catch(() => toast({ title: 'Erro', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total',
            value: stats?.total_credentials ?? 0,
            icon: Key,
            color: 'hsl(var(--nexus-purple))',
          },
          {
            label: 'Ativas',
            value: stats?.active ?? 0,
            icon: ShieldCheck,
            color: 'hsl(var(--nexus-emerald))',
          },
          {
            label: 'Expiradas',
            value: stats?.expired ?? 0,
            icon: AlertTriangle,
            color: 'hsl(var(--nexus-red))',
          },
          {
            label: 'Expirando',
            value: stats?.expiring_soon ?? 0,
            icon: AlertTriangle,
            color: 'hsl(var(--nexus-yellow))',
          },
          {
            label: 'Rotação Pendente',
            value: stats?.rotation_due ?? 0,
            icon: RotateCcw,
            color: 'hsl(var(--nexus-orange))',
          },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <s.icon size={18} className="mx-auto mb-1" style={{ color: s.color }} />
              <p className="text-xl font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Templates de Credencial</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(CREDENTIAL_TEMPLATES).map(([key, tpl]) => (
              <div
                key={key}
                className="p-3 rounded-lg bg-background border border-border hover:border-nexus-purple/50 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{TYPE_ICONS[tpl.type] ?? '🔑'}</span>
                  <p className="font-medium text-sm">{tpl.label}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{tpl.fields.join(', ')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando vault...</div>
      ) : credentials.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Lock size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhuma credencial armazenada.</p>
            <p className="text-sm mt-1">
              Use os templates acima para adicionar credenciais com segurança.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {credentials.map((c) => (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-lg">{TYPE_ICONS[c.credential_type] ?? '🔑'}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.service_name} • {c.access_count} acessos
                  </p>
                </div>
                <Badge
                  className={
                    c.status === 'active'
                      ? 'bg-nexus-emerald/20 text-nexus-emerald'
                      : c.status === 'expired'
                        ? 'bg-destructive/20 text-destructive'
                        : 'bg-nexus-amber/20 text-nexus-amber'
                  }
                >
                  {c.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
