import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Clock, Globe, User, Users, Database, Settings, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  source: string;
  createdAt: string;
}

const memoryTypes = [
  { key: 'short_term', icon: Clock, title: 'Short-term', desc: 'Memória da conversa atual', retention: 'Sessão', color: 'text-nexus-cyan' },
  { key: 'episodic', icon: Brain, title: 'Episódica', desc: 'Eventos e interações passadas', retention: '90 dias', color: 'text-primary' },
  { key: 'semantic', icon: Globe, title: 'Semântica', desc: 'Conhecimento geral aprendido', retention: 'Permanente', color: 'text-nexus-emerald' },
  { key: 'user_profile', icon: User, title: 'Perfil do Usuário', desc: 'Preferências individuais', retention: 'Até remoção', color: 'text-nexus-amber' },
  { key: 'team', icon: Users, title: 'Team / Shared', desc: 'Contexto compartilhado entre agentes', retention: 'Permanente', color: 'text-nexus-glow' },
  { key: 'external', icon: Database, title: 'Conectores Externos', desc: 'Redis, Pinecone, PostgreSQL', retention: 'Conforme provider', color: 'text-muted-foreground' },
];

export default function MemoryPage() {
  const [activeType, setActiveType] = useState('semantic');
  const [entries, setEntries] = useState<MemoryEntry[]>([
    { id: '1', type: 'semantic', content: 'API v3 exige header X-Auth para autenticação', source: 'Documentação Técnica', createdAt: '2026-03-28' },
    { id: '2', type: 'semantic', content: 'Formato de data padrão: DD/MM/YYYY', source: 'Convenções', createdAt: '2026-03-25' },
    { id: '3', type: 'episodic', content: 'Ticket #4521 resolvido em 3 minutos — usuário satisfeito', source: 'Agente Atlas', createdAt: '2026-03-29' },
    { id: '4', type: 'episodic', content: 'Usuário João reportou bug no módulo de exportação', source: 'Agente Atlas', createdAt: '2026-03-28' },
    { id: '5', type: 'user_profile', content: 'Preferência: respostas em pt-BR, tom informal', source: 'Perfil automático', createdAt: '2026-03-27' },
    { id: '6', type: 'team', content: 'Sprint 14: foco em performance e redução de latência', source: 'Workspace compartilhado', createdAt: '2026-03-30' },
  ]);
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('');
  const [search, setSearch] = useState('');

  const filteredEntries = entries.filter(e =>
    e.type === activeType &&
    (search ? e.content.toLowerCase().includes(search.toLowerCase()) : true)
  );

  const handleAdd = () => {
    if (!newContent.trim()) { toast.error('Conteúdo é obrigatório'); return; }
    setEntries(prev => [...prev, {
      id: Date.now().toString(),
      type: activeType,
      content: newContent.trim(),
      source: newSource.trim() || 'Manual',
      createdAt: new Date().toISOString().split('T')[0],
    }]);
    setNewContent(''); setNewSource('');
    toast.success('Memória adicionada!');
  };

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Memória removida');
  };

  const activeConfig = memoryTypes.find(m => m.key === activeType)!;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Memory Studio" description="Configure e gerencie camadas de memória para seus agentes de IA" />

      <InfoHint title="Por que memória importa?">
        Agentes sem memória tratam cada conversa como nova. Com memória de curto prazo, mantêm contexto na sessão. Com memória de longo prazo (episódica e semântica), aprendem com interações passadas e personalizam respostas.
      </InfoHint>

      {/* Memory type selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {memoryTypes.map(mem => (
          <button
            key={mem.key}
            onClick={() => setActiveType(mem.key)}
            className={`nexus-card text-left p-3 transition-all ${activeType === mem.key ? 'border-primary/40 bg-primary/5' : 'hover:border-border'}`}
          >
            <mem.icon className={`h-5 w-5 mb-2 ${mem.color}`} />
            <p className="text-xs font-semibold text-foreground">{mem.title}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{mem.retention}</p>
            <Badge variant="outline" className="text-[8px] mt-2">
              {entries.filter(e => e.type === mem.key).length} itens
            </Badge>
          </button>
        ))}
      </div>

      {/* Active memory management */}
      <div className="nexus-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <activeConfig.icon className={`h-5 w-5 ${activeConfig.color}`} />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{activeConfig.title}</h3>
              <p className="text-[10px] text-muted-foreground">{activeConfig.desc}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">{filteredEntries.length} itens</Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar memórias..." className="pl-9 bg-secondary/50 text-xs" />
        </div>

        {/* Add new entry */}
        <div className="p-3 rounded-lg bg-secondary/20 border border-border/30 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adicionar memória</p>
          <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Conteúdo da memória..." rows={2} className="bg-secondary/50 text-xs" />
          <div className="flex gap-2">
            <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Fonte (opcional)" className="bg-secondary/50 text-xs flex-1" />
            <Button size="sm" onClick={handleAdd} className="gap-1 nexus-gradient-bg text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Entries list */}
        <div className="space-y-2">
          <AnimatePresence>
            {filteredEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma memória nesta categoria</p>
            ) : (
              filteredEntries.map(entry => (
                <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30 group"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">{entry.content}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-muted-foreground">{entry.source}</span>
                      <span className="text-[9px] text-muted-foreground">•</span>
                      <span className="text-[9px] text-muted-foreground">{entry.createdAt}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
