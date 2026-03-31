import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, SliderField, ToggleField, SelectField } from '../ui';
import { cn } from '@/lib/utils';
import { PipelineFlow } from '../ui/PipelineFlow';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import type { RAGArchitecture, VectorDB } from '@/types/agentTypes';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RAGArchInfo {
  id: RAGArchitecture;
  icon: string;
  title: string;
  description: string;
  complexity: number;
  best_for: string;
  pros: string[];
  cons: string[];
}

const RAG_ARCHITECTURES: RAGArchInfo[] = [
  { id: 'naive', icon: '📄', title: 'RAG Básico', complexity: 1, description: 'Query → Retrieve → Generate. Simples e eficaz para perguntas diretas.', best_for: 'FAQ, documentação interna', pros: ['Implementação rápida', 'Baixo custo', 'Fácil debug'], cons: ['Sem re-ranking', 'Falha em queries complexas'] },
  { id: 'advanced', icon: '🔬', title: 'RAG Avançado', complexity: 2, description: 'Hybrid Search + Reranking + Metadata Filtering. Precisão superior.', best_for: 'Knowledge bases corporativas', pros: ['Melhor precisão', 'Filtros por metadata', 'BM25 + Vector'], cons: ['Mais complexo', 'Re-ranker adiciona latência'] },
  { id: 'modular', icon: '🧩', title: 'RAG Modular', complexity: 3, description: 'Pipeline plugável por etapa. Cada módulo é substituível e testável.', best_for: 'Times técnicos que otimizam cada etapa', pros: ['Flexibilidade total', 'Testável por etapa', 'Cada módulo substituível'], cons: ['Mais componentes', 'Requer mais expertise'] },
  { id: 'agentic', icon: '🤖', title: 'Agentic RAG', complexity: 4, description: 'Agentes decidem QUANDO, ONDE e COMO buscar. Multi-step com auto-correção.', best_for: 'Agentes complexos multi-source', pros: ['Adaptativo', 'Multi-source', 'Self-correcting'], cons: ['Custo maior (mais chamadas LLM)', 'Latência variável'] },
  { id: 'graph_rag', icon: '🕸️', title: 'GraphRAG', complexity: 5, description: 'Knowledge Graphs + Vector Search. Multi-hop reasoning com alta precisão.', best_for: 'Jurídico, saúde, supply chain', pros: ['Precisão extrema', 'Multi-hop reasoning', 'Relações complexas'], cons: ['Setup complexo', 'Requer knowledge graph'] },
];

interface VectorDBInfo {
  id: VectorDB;
  icon: string;
  title: string;
  description: string;
  cost: string;
  best_for: string;
  tierColor: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'orange';
}

const VECTOR_DBS: VectorDBInfo[] = [
  { id: 'chroma', icon: '🎨', title: 'ChromaDB', cost: '$0-30/mês', best_for: 'Simplicidade, prototipação rápida', description: 'Recomendação #1 para começar. Leva de zero a produção em minutos.', tierColor: 'red' },
  { id: 'qdrant', icon: '🔷', title: 'Qdrant', cost: '$30-300/mês', best_for: 'Produção, performance Rust, compliance', description: 'Melhor custo-benefício para produção séria. Escrito em Rust.', tierColor: 'green' },
  { id: 'pinecone', icon: '🌲', title: 'Pinecone', cost: '$70-1500/mês', best_for: 'Zero ops, escala automática', description: 'Pague mais, preocupe-se menos. Escala sem limite.', tierColor: 'blue' },
  { id: 'pgvector', icon: '🐘', title: 'pgvector', cost: '$0 incremental', best_for: 'Stack PostgreSQL/Supabase existente', description: 'Se já tem Supabase, é a escolha mais natural.', tierColor: 'yellow' },
  { id: 'weaviate', icon: '🔮', title: 'Weaviate', cost: '$50-400/mês', best_for: 'Hybrid search nativo, GraphQL API', description: 'Poderoso mas complexo. Só se precisar dos módulos de vectorização.', tierColor: 'purple' },
  { id: 'lancedb', icon: '🗄️', title: 'LanceDB', cost: '<$30/mês', best_for: 'Edge, embedded, disco-eficiente', description: 'Mais eficiente em disco que ChromaDB para datasets maiores.', tierColor: 'orange' },
];

const EMBEDDING_MODELS = [
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large (OpenAI)' },
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small (OpenAI)' },
  { value: 'voyage-3', label: 'Voyage 3 (Anthropic)' },
  { value: 'nomic-embed-text', label: 'Nomic Embed Text' },
  { value: 'custom', label: 'Custom' },
];

const RAG_PIPELINE_STEPS = [
  { icon: '📥', label: 'Ingestão' },
  { icon: '✂️', label: 'Chunking' },
  { icon: '🧮', label: 'Embedding' },
  { icon: '💾', label: 'Vector Store' },
  { icon: '🔍', label: 'Query' },
  { icon: '📊', label: 'Reranking' },
  { icon: '🧠', label: 'LLM' },
  { icon: '✅', label: 'Response' },
];

const SOURCE_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'url', label: 'URL / Website' },
  { value: 'google_drive', label: 'Google Drive' },
  { value: 'notion', label: 'Notion' },
  { value: 'confluence', label: 'Confluence' },
  { value: 'csv', label: 'CSV' },
  { value: 'docx', label: 'DOCX' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API' },
];

export function RAGModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const addSource = () => {
    const newSource = {
      id: crypto.randomUUID(),
      name: '',
      type: 'pdf' as const,
      location: '',
      sync_frequency: 'manual' as const,
      enabled: true,
    };
    updateAgent({ rag_sources: [...agent.rag_sources, newSource] });
  };

  const removeSource = (id: string) => {
    updateAgent({ rag_sources: agent.rag_sources.filter((s) => s.id !== id) });
  };

  const updateSource = (id: string, partial: Record<string, unknown>) => {
    updateAgent({
      rag_sources: agent.rag_sources.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    });
  };

  return (
    <div className="space-y-10">
      {/* Seção A — Arquitetura RAG */}
      <section>
        <SectionTitle
          icon="📚"
          title="Arquitetura RAG"
          subtitle="Escolha a abordagem de Retrieval-Augmented Generation do agente."
        />
        <div className="space-y-3">
          {RAG_ARCHITECTURES.map((a) => {
            const selected = agent.rag_architecture === a.id;
            return (
              <button
                key={a.id}
                onClick={() => updateAgent({ rag_architecture: a.id })}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all duration-200',
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl" aria-hidden="true">{a.icon}</span>
                  <h3 className="text-sm font-semibold text-foreground flex-1">{a.title}</h3>
                  <div className="flex gap-0.5" aria-label={`Complexidade ${a.complexity} de 5`}>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <div key={d} className={cn('h-2 w-2 rounded-full', d <= a.complexity ? 'bg-primary' : 'bg-muted')} />
                    ))}
                  </div>
                  {a.complexity === 4 && <NexusBadge color="green">Recomendado</NexusBadge>}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{a.description}</p>
                <p className="text-[11px] text-muted-foreground/70 mb-2">Melhor para: {a.best_for}</p>
                <div className="flex flex-wrap gap-1">
                  {a.pros.map((p) => (
                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{p}</span>
                  ))}
                  {a.cons.map((c) => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">{c}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Seção B — Banco Vetorial */}
      <section>
        <SectionTitle icon="🗄️" title="Banco Vetorial" subtitle="Onde os embeddings serão armazenados e consultados." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VECTOR_DBS.map((db) => {
            const selected = agent.rag_vector_db === db.id;
            return (
              <button
                key={db.id}
                onClick={() => updateAgent({ rag_vector_db: db.id })}
                className={cn(
                  'text-left rounded-xl border p-4 transition-all duration-200',
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{db.icon} {db.title}</h3>
                  <NexusBadge color={db.tierColor}>{db.cost}</NexusBadge>
                </div>
                <p className="text-[11px] text-muted-foreground mb-1">{db.best_for}</p>
                <p className="text-[10px] text-muted-foreground/70">{db.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Seção C — Pipeline de Ingestão */}
      <section>
        <SectionTitle icon="⚙️" title="Pipeline de Ingestão" subtitle="Configuração de chunking, embedding e indexação." />
        <div className="rounded-xl border border-border bg-card p-4 mb-4 overflow-x-auto">
          <PipelineFlow steps={RAG_PIPELINE_STEPS} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Modelo de Embedding"
            value={agent.rag_embedding_model}
            onChange={(v) => updateAgent({ rag_embedding_model: v })}
            options={EMBEDDING_MODELS}
          />
          <SliderField
            label="Chunk Size"
            value={agent.rag_chunk_size}
            onChange={(v) => updateAgent({ rag_chunk_size: v })}
            min={100}
            max={2000}
            step={50}
            unit=" tokens"
          />
          <SliderField
            label="Chunk Overlap"
            value={agent.rag_chunk_overlap}
            onChange={(v) => updateAgent({ rag_chunk_overlap: v })}
            min={0}
            max={50}
            step={1}
            unit="%"
          />
        </div>
      </section>

      {/* Seção D — Retrieval Config */}
      <section>
        <SectionTitle icon="🔍" title="Configuração de Retrieval" subtitle="Como o agente busca e filtra contexto relevante." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderField
            label="Top K"
            value={agent.rag_top_k}
            onChange={(v) => updateAgent({ rag_top_k: v })}
            min={1}
            max={20}
            step={1}
            description="Número de chunks retornados por busca."
          />
          <SliderField
            label="Threshold de Similaridade"
            value={agent.rag_similarity_threshold}
            onChange={(v) => updateAgent({ rag_similarity_threshold: v })}
            min={0}
            max={100}
            step={1}
            unit="%"
            description="Mínimo de similaridade para incluir um chunk."
          />
        </div>
        <div className="mt-4 space-y-3">
          <ToggleField
            label="Reranker"
            description="Reordena resultados para melhorar relevância."
            checked={agent.rag_reranker}
            onCheckedChange={(v) => updateAgent({ rag_reranker: v })}
          />
          <ToggleField
            label="Busca Híbrida"
            description="Combina busca vetorial com keyword search (BM25)."
            checked={agent.rag_hybrid_search}
            onCheckedChange={(v) => updateAgent({ rag_hybrid_search: v })}
          />
          <ToggleField
            label="Filtragem por Metadados"
            description="Filtra chunks por tags, data, fonte, etc."
            checked={agent.rag_metadata_filtering}
            onCheckedChange={(v) => updateAgent({ rag_metadata_filtering: v })}
          />
        </div>
      </section>

      {/* Seção E — Fontes de Conhecimento */}
      <section>
        <SectionTitle
          icon="📂"
          title="Fontes de Conhecimento"
          subtitle="Documentos, APIs e bases de dados conectadas ao RAG."
          badge={<NexusBadge color="blue">{agent.rag_sources.length} fontes</NexusBadge>}
        />
        <div className="space-y-3">
          {agent.rag_sources.map((source) => (
            <CollapsibleCard
              key={source.id}
              icon="📄"
              title={source.name || 'Nova Fonte'}
              subtitle={source.location || 'Sem localização definida'}
              badge={<NexusBadge color={source.enabled ? 'green' : 'muted'}>{source.enabled ? 'Ativa' : 'Inativa'}</NexusBadge>}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Nome</label>
                    <input
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                      value={source.name}
                      onChange={(e) => updateSource(source.id, { name: e.target.value })}
                      placeholder="Ex: Base de conhecimento interna"
                    />
                  </div>
                  <SelectField
                    label="Tipo"
                    value={source.type}
                    onChange={(v) => updateSource(source.id, { type: v })}
                    options={SOURCE_TYPES}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Localização / URL</label>
                  <input
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                    value={source.location}
                    onChange={(e) => updateSource(source.id, { location: e.target.value })}
                    placeholder="URL, caminho ou connection string"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <SelectField
                    label="Frequência de Sync"
                    value={source.sync_frequency}
                    onChange={(v) => updateSource(source.id, { sync_frequency: v })}
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'hourly', label: 'A cada hora' },
                      { value: 'daily', label: 'Diário' },
                      { value: 'weekly', label: 'Semanal' },
                    ]}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive mt-5 ml-3"
                    onClick={() => removeSource(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ToggleField
                  label="Ativa"
                  checked={source.enabled}
                  onCheckedChange={(v) => updateSource(source.id, { enabled: v })}
                />
              </div>
            </CollapsibleCard>
          ))}
          <Button variant="outline" size="sm" onClick={addSource} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Fonte
          </Button>
        </div>
      </section>

      {/* Seção F — Quality Panel */}
      <section>
        <SectionTitle icon="📊" title="Qualidade do RAG" subtitle="Métricas recomendadas para avaliar a qualidade do pipeline." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <span className="text-2xl" aria-hidden="true">📊</span>
            <p className="text-sm font-semibold text-foreground mt-2">Cobertura</p>
            <p className="text-[11px] text-muted-foreground mt-1">% dos temas do domínio cobertos pela base</p>
            <p className="text-lg font-mono font-bold text-primary mt-1">
              {agent.rag_sources.length > 0 ? `~${Math.min(agent.rag_sources.filter(s => s.enabled).length * 20, 95)}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <span className="text-2xl" aria-hidden="true">🎯</span>
            <p className="text-sm font-semibold text-foreground mt-2">Precisão</p>
            <p className="text-[11px] text-muted-foreground mt-1">% dos chunks relevantes nos top-K</p>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
              {agent.rag_reranker ? '~92%' : agent.rag_hybrid_search ? '~85%' : '~75%'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <span className="text-2xl" aria-hidden="true">🕐</span>
            <p className="text-sm font-semibold text-foreground mt-2">Freshness</p>
            <p className="text-[11px] text-muted-foreground mt-1">Idade média dos documentos indexados</p>
            <p className="text-lg font-mono font-bold text-amber-400 mt-1">
              {agent.rag_sources.length > 0 ? '< 7 dias' : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <span className="text-2xl" aria-hidden="true">📑</span>
            <p className="text-sm font-semibold text-foreground mt-2">Citação</p>
            <p className="text-[11px] text-muted-foreground mt-1">% das respostas com fonte identificada</p>
            <p className="text-lg font-mono font-bold text-blue-400 mt-1">
              {agent.rag_metadata_filtering ? '~88%' : '~65%'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
