import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  listConnectors,
  listInstances,
  BUILTIN_CONNECTORS,
  type ConnectorDefinition,
  type ConnectorInstance,
} from '@/services/connectorRegistryService';
import { useToast } from '@/hooks/use-toast';

export function ConnectorRegistryPanel() {
  const [connectors, setConnectors] = useState<ConnectorDefinition[]>([]);
  const [instances, setInstances] = useState<ConnectorInstance[]>([]);
  const [, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([listConnectors(), listInstances()])
      .then(([c, i]) => {
        setConnectors(c);
        setInstances(i);
      })
      .catch(() => toast({ title: 'Erro', variant: 'destructive' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayConnectors =
    connectors.length > 0 ? connectors : (BUILTIN_CONNECTORS as unknown as ConnectorDefinition[]);
  const connectedIds = new Set(
    instances.filter((i) => i.status === 'connected').map((i) => i.connector_id),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Conectores', value: displayConnectors.length, color: 'hsl(var(--nexus-blue))' },
          {
            label: 'Conectados',
            value: instances.filter((i) => i.status === 'connected').length,
            color: 'hsl(var(--nexus-emerald))',
          },
          {
            label: 'Uso Total',
            value: instances.reduce((s, i) => s + i.usage_count, 0),
            color: 'hsl(var(--nexus-purple))',
          },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayConnectors.map((conn) => {
          const isConnected = connectedIds.has(conn.id);
          return (
            <Card
              key={conn.slug}
              className="bg-card border-border hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{conn.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{conn.name}</p>
                      <Badge variant="outline" className="text-[10px] border-border">
                        {conn.category}
                      </Badge>
                    </div>
                  </div>
                  {isConnected ? (
                    <CheckCircle size={18} className="text-nexus-emerald" />
                  ) : (
                    <XCircle size={18} className="text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {conn.description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{conn.operations.length} operações</span>
                  <span>{conn.auth_type}</span>
                  {conn.supports_webhooks && (
                    <Badge variant="outline" className="text-[10px] border-border">
                      Webhook
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
