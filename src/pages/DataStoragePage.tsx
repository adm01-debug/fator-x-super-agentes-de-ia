import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Database, Server, HardDrive, Cpu, Radio, FileText, Settings, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface StorageBackend {
  id: string; icon: React.ElementType; name: string; type: string;
  status: 'active' | 'inactive' | 'error'; usage: string; capacity: string;
  latency: string; cost: string; health: string; desc: string;
  connectionString: string; enabled: boolean;
}

const SEED_STORES: StorageBackend[] = [
  { id: 's1', icon: Database, name: 'pgvector', type: 'Vector DB', status: 'active', usage: '8.2 GB', capacity: '20 GB', latency: '12ms', cost: 'R$ 0,00', health: 'Saudável', desc: 'Banco vetorial integrado via extensão PostgreSQL', connectionString: 'postgresql://...supabase.co:5432/postgres', enabled: true },
  { id: 's2', icon: Database, name: 'Pinecone', type: 'Vector DB', status: 'active', usage: '3.1 GB', capacity: '10 GB', latency: '18ms', cost: 'R$ 45/mês', health: 'Saudável', desc: 'Banco vetorial serverless para alta escala', connectionString: 'https://xxx.pinecone.io', enabled: true },
  { id: 's3', icon: Server, name: 'PostgreSQL', type: 'Relational DB', status: 'active', usage: '2.4 GB', capacity: '50 GB', latency: '5ms', cost: 'Incluso', health: 'Saudável', desc: 'Banco principal para dados estruturados', connectionString: 'postgresql://...supabase.co:5432/postgres', enabled: true },
  { id: 's4', icon: FileText, name: 'Document Store', type: 'Document DB', status: 'active', usage: '1.8 GB', capacity: '10 GB', latency: '8ms', cost: 'R$ 12/mês', health: 'Saudável', desc: 'Armazenamento flexível para documentos JSON', connectionString: '', enabled: true },
  { id: 's5', icon: HardDrive, name: 'Object Storage', type: 'Files', status: 'active', usage: '12.4 GB', capacity: '100 GB', latency: '45ms', cost: 'R$ 2,50/mês', health: 'Saudável', desc: 'Supabase Storage para arquivos e artefatos', connectionString: 'https://...supabase.co/storage/v1', enabled: true },
  { id: 's6', icon: Cpu, name: 'Redis Cache', type: 'Cache', status: 'inactive', usage: '0 MB', capacity: '1 GB', latency: '—', cost: 'R$ 8/mês', health: '—', desc: 'Cache de sessão e estado do agente', connectionString: '', enabled: false },
  { id: 's7', icon: Radio, name: 'Event Bus', type: 'Message Queue', status: 'inactive', usage: '—', capacity: '—', latency: '—', cost: 'R$ 5/mês', health: '—', desc: 'Fila de eventos para workflows assíncronos', connectionString: '', enabled: false },
];

export default function DataStoragePage() {
  const [stores, setStores] = useState<StorageBackend[]>(SEED_STORES);
  const [configuring, setConfiguring] = useState<string | null>(null);

  const toggleBackend = useCallback((id: string) => {
    setStores(prev => prev.map(s => {
      if (s.id !== id) return s;
      const enabled = !s.enabled;
      return { ...s, enabled, status: enabled ? 'active' as const : 'inactive' as const, health: enabled ? 'Saudável' : '—' };
    }));
    toast.success('Status atualizado');
  }, []);

  const updateConnection = useCallback((id: string, conn: string) => {
    setStores(prev => prev.map(s => s.id === id ? { ...s, connectionString: conn } : s));
  }, []);

  const testConnection = useCallback((id: string) => {
    const store = stores.find(s => s.id === id);
    if (!store) return;
    toast.info(`Testando ${store.name}...`);
    setTimeout(() => {
      if (store.connectionString) {
        toast.success(`${store.name}: Conexão OK — ${store.latency}`);
      } else {
        toast.error(`${store.name}: Connection string não configurada`);
      }
    }, 1000);
  }, [stores]);

  const activeCount = stores.filter(s => s.enabled).length;
  const totalUsage = stores.filter(s => s.usage !== '—' && s.usage !== '0 MB').reduce((s, st) => {
    const match = st.usage.match(/([\d.]+)\s*(GB|MB)/);
    if (!match) return s;
    return s + (match[2] === 'GB' ? parseFloat(match[1]) : parseFloat(match[1]) / 1024);
  }, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Data & Storage" description="Arquitetura de dados: bancos vetoriais, relacionais, cache e storage" />

      <InfoHint title="Por que banco vetorial?">
        Bancos vetoriais armazenam embeddings para busca semântica. Essencial para RAG de alta qualidade.
      </InfoHint>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Backends ativos', value: activeCount, color: 'text-emerald-400' },
          { label: 'Uso total', value: `${totalUsage.toFixed(1)} GB`, color: 'text-foreground' },
          { label: 'Backends disponíveis', value: stores.length, color: 'text-primary' },
          { label: 'Custo mensal', value: 'R$ 72,50', color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map(s => {
          const isConfiguring = configuring === s.id;
          return (
            <div key={s.id} className={`nexus-card ${!s.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><s.icon className="h-5 w-5 text-primary" /></div>
                  <div><h3 className="text-sm font-semibold text-foreground">{s.name}</h3><p className="text-[11px] text-muted-foreground">{s.type}</p></div>
                </div>
                <Switch checked={s.enabled} onCheckedChange={() => toggleBackend(s.id)} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>

              <div className="space-y-2 text-xs border-t border-border/50 pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Uso</span><span className="text-foreground">{s.usage}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Capacidade</span><span className="text-foreground">{s.capacity}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Latência</span><span className="text-foreground">{s.latency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><span className="text-foreground">{s.cost}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span className={s.health === 'Saudável' ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}>{s.health}</span></div>
              </div>

              {isConfiguring && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <label className="text-[10px] text-muted-foreground">Connection String</label>
                  <input value={s.connectionString} onChange={e => updateConnection(s.id, e.target.value)} placeholder="postgresql://user:pass@host:5432/db" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-[10px] text-foreground font-mono" />
                  <Button variant="outline" size="sm" className="w-full text-[10px] h-7" onClick={() => testConnection(s.id)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Testar Conexão
                  </Button>
                </div>
              )}

              <div className="flex gap-1 mt-3 pt-3 border-t border-border/50">
                <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => setConfiguring(isConfiguring ? null : s.id)}>
                  <Settings className="h-3 w-3 mr-1" /> {isConfiguring ? 'Fechar' : 'Configurar'}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => testConnection(s.id)}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Health Check
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
