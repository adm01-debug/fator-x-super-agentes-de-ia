import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, ConfigCard, NexusBadge, SliderField, ToggleField, SelectField } from '../ui';
import { SelectionGrid } from '../ui/SelectionGrid';
import { PipelineFlow } from '../ui/PipelineFlow';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import type { RAGArchitecture, VectorDB } from '@/types/agentTypes';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RAG_ARCHITECTURES: {
  id: RAGArchitecture;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}[] = [
  {
    id: 'naive',
    icon: '📄',
    title: 'Naive RAG',
    description: 'Embed → retrieve → generate. Simples e rápido.',
  },
  {
    id: 'advanced',
    icon: '🔬',
    title: 'Advanced RAG',
    description: 'Com reranking, query expansion e feedback loop.',
  },
  {
    id: 'modular',
    icon: '🧩',
    title: 'Modular RAG',
    description: 'Pipeline customizável com módulos intercambiáveis.',
  },
  {
    id: 'agentic',
    icon: '🤖',
    title: 'Agentic RAG',
    description: 'O agente decide quando e como buscar contexto.',
    badge: 'Recomendado',
  },
  {
    id: 'graph_rag',
    icon: '🕸️',
    title: 'Graph RAG',
    description: 'Combina grafos de conhecimento com recuperação vetorial.',
  },
];

const VECTOR_DBS: { id: VectorDB; icon: string; title: string; description: string }[] = [
  { id: 'qdrant', icon: '🔷', title: 'Qdrant', description: 'Alto desempenho, filtros avançados.' },
  {
    id: 'pinecone',
    icon: '🌲',
    title: 'Pinecone',
    description: 'Serverless, escalável e gerenciado.',
  },
  { id: 'chroma', icon: '🎨', title: 'Chroma', description: 'Open-source, simples de usar.' },
  {
    id: 'pgvector',
    icon: '🐘',
    title: 'pgvector',
    description: 'Extensão PostgreSQL. Sem infra extra.',
  },
  { id: 'weaviate', icon: '🔮', title: 'Weaviate', description: 'Busca híbrida nativa e GraphQL.' },
  {
    id: 'lancedb',
    icon: '🗄️',
    title: 'LanceDB',
    description: 'Serverless e embarcado. Zero config.',
  },
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
        <SelectionGrid
          items={RAG_ARCHITECTURES.map((a) => ({
            ...a,
            badge: a.badge ? <NexusBadge color="green">{a.badge}</NexusBadge> : undefined,
          }))}
          value={agent.rag_architecture}
          onChange={(v) => updateAgent({ rag_architecture: v as RAGArchitecture })}
          columns={3}
        />
      </section>

      {/* Seção B — Banco Vetorial */}
      <section>
        <SectionTitle
          icon="🗄️"
          title="Banco Vetorial"
          subtitle="Onde os embeddings serão armazenados e consultados."
        />
        <SelectionGrid
          items={VECTOR_DBS}
          value={agent.rag_vector_db}
          onChange={(v) => updateAgent({ rag_vector_db: v as VectorDB })}
          columns={3}
        />
      </section>

      {/* Seção C — Pipeline de Ingestão */}
      <section>
        <SectionTitle
          icon="⚙️"
          title="Pipeline de Ingestão"
          subtitle="Configuração de chunking, embedding e indexação."
        />
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
        <SectionTitle
          icon="🔍"
          title="Configuração de Retrieval"
          subtitle="Como o agente busca e filtra contexto relevante."
        />
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
              badge={
                <NexusBadge color={source.enabled ? 'green' : 'muted'}>
                  {source.enabled ? 'Ativa' : 'Inativa'}
                </NexusBadge>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-foreground">Nome</span>
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
                  <span className="text-xs font-medium text-foreground">Localização / URL</span>
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
        <SectionTitle
          icon="📊"
          title="Qualidade do RAG"
          subtitle="Resumo da configuração atual do pipeline RAG."
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ConfigCard
            icon="📐"
            title="Arquitetura"
            description={
              RAG_ARCHITECTURES.find((a) => a.id === agent.rag_architecture)?.title ??
              agent.rag_architecture
            }
          />
          <ConfigCard
            icon="🗄️"
            title="Vector DB"
            description={
              VECTOR_DBS.find((d) => d.id === agent.rag_vector_db)?.title ?? agent.rag_vector_db
            }
          />
          <ConfigCard
            icon="📄"
            title="Fontes"
            description={`${agent.rag_sources.filter((s) => s.enabled).length} ativas`}
          />
          <ConfigCard
            icon="✅"
            title="Features"
            description={
              [
                agent.rag_reranker && 'Reranker',
                agent.rag_hybrid_search && 'Híbrida',
                agent.rag_metadata_filtering && 'Metadados',
              ]
                .filter(Boolean)
                .join(', ') || 'Nenhuma'
            }
          />
        </div>
      </section>
    </div>
  );
}
