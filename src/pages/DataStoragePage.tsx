import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Database, Server, HardDrive, Cpu, Radio, FileText } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

const stores = [
  { icon: Database, name: 'pgvector', type: 'Vector DB', status: 'active' as const, usage: '8.2 GB', capacity: '20 GB', latency: '12ms', cost: 'R$ 0,00', health: 'Saudável', desc: 'Banco vetorial integrado via extensão PostgreSQL' },
  { icon: Database, name: 'Pinecone', type: 'Vector DB', status: 'active' as const, usage: '3.1 GB', capacity: '10 GB', latency: '18ms', cost: 'R$ 45/mês', health: 'Saudável', desc: 'Banco vetorial serverless para alta escala' },
  { icon: Server, name: 'PostgreSQL', type: 'Relational DB', status: 'active' as const, usage: '2.4 GB', capacity: '50 GB', latency: '5ms', cost: 'Incluso', health: 'Saudável', desc: 'Banco principal para dados estruturados' },
  { icon: FileText, name: 'Document Store', type: 'Document DB', status: 'active' as const, usage: '1.8 GB', capacity: '10 GB', latency: '8ms', cost: 'R$ 12/mês', health: 'Saudável', desc: 'Armazenamento flexível tipo MongoDB' },
  { icon: HardDrive, name: 'Object Storage', type: 'Files', status: 'active' as const, usage: '12.4 GB', capacity: '100 GB', latency: '45ms', cost: 'R$ 2,50/mês', health: 'Saudável', desc: 'Armazenamento de arquivos e artefatos' },
  { icon: Cpu, name: 'Redis Cache', type: 'Cache', status: 'active' as const, usage: '256 MB', capacity: '1 GB', latency: '1ms', cost: 'R$ 8/mês', health: 'Saudável', desc: 'Cache de sessão e estado do agente' },
  { icon: Radio, name: 'Event Bus', type: 'Message Queue', status: 'active' as const, usage: '—', capacity: '—', latency: '3ms', cost: 'R$ 5/mês', health: 'Saudável', desc: 'Fila de eventos para workflows assíncronos' },
];

export default function DataStoragePage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Data & Storage" description="Arquitetura de dados: bancos vetoriais, relacionais, cache e storage" />

      <InfoHint title="Por que banco vetorial?">
        Bancos vetoriais armazenam embeddings — representações numéricas de texto. Permitem busca semântica, onde o agente encontra informações por significado, não por palavras-chave exatas. Essencial para RAG de alta qualidade.
      </InfoHint>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((s, i) => (
          <div key={s.name} className="nexus-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{s.type}</p>
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>
            <div className="space-y-2 text-xs border-t border-border/50 pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Uso</span><span className="text-foreground">{s.usage}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Capacidade</span><span className="text-foreground">{s.capacity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Latência</span><span className="text-foreground">{s.latency}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><span className="text-foreground">{s.cost}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span className="text-nexus-emerald font-medium">{s.health}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
