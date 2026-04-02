import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import * as ragPipeline from "@/services/ragPipeline";
import * as edgeFunctions from "@/services/edgeFunctions";
import { Plus, Search, BookOpen, RefreshCw, ArrowRight, Trash2, Upload, X, Save, Settings, FileText } from "lucide-react";
import { toast } from "sonner";

// ═══ TYPES ═══

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  vectorDb: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  documents: number;
  chunks: number;
  status: 'production' | 'draft' | 'syncing';
  lastSync: string;
  owner: string;
}

// ═══ SEED DATA ═══

const SEED_KBS: KnowledgeBase[] = [
  { id: 'kb1', name: 'Políticas Comerciais', description: 'Regras de desconto, prazo, frete e condições', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-small', chunkSize: 512, chunkOverlap: 50, documents: 24, chunks: 1240, status: 'production', lastSync: '2026-03-31 09:00', owner: 'Cérebro' },
  { id: 'kb2', name: 'Catálogo de Produtos', description: 'Fichas técnicas, preços, especificações de 6K produtos', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-small', chunkSize: 1024, chunkOverlap: 100, documents: 156, chunks: 8920, status: 'production', lastSync: '2026-03-30 22:00', owner: 'Catálogo' },
  { id: 'kb3', name: 'FAQ & Suporte', description: 'Perguntas frequentes e resoluções de problemas', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-small', chunkSize: 256, chunkOverlap: 30, documents: 89, chunks: 2100, status: 'production', lastSync: '2026-03-31 06:00', owner: 'Suporte' },
  { id: 'kb4', name: 'Processos Internos', description: 'SOPs, workflows, checklists do time', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-small', chunkSize: 512, chunkOverlap: 50, documents: 12, chunks: 340, status: 'draft', lastSync: 'Nunca', owner: 'RH' },
];

const VECTOR_DBS = ['pgvector', 'Pinecone', 'Weaviate', 'Qdrant', 'ChromaDB'];
const EMBEDDING_MODELS = ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002', 'voyage-3', 'nomic-embed-text'];
const PIPELINE_STEPS = ['📥 Upload', '📄 Parsing', '✂️ Chunking', '🏷️ Metadata', '🧮 Embeddings', '💾 Indexing'];

// ═══ MAIN PAGE ═══

export default function KnowledgePage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>(SEED_KBS);
  const [showCreate, setShowCreate] = useState(false);
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVectorDb, setNewVectorDb] = useState('pgvector');
  const [newEmbedding, setNewEmbedding] = useState('text-embedding-3-small');
  const [newChunkSize, setNewChunkSize] = useState(512);
  const [newChunkOverlap, setNewChunkOverlap] = useState(50);

  const createKb = useCallback(() => {
    if (!newName.trim()) { toast.error('Nome é obrigatório'); return; }
    const kb: KnowledgeBase = {
      id: `kb-${Date.now()}`, name: newName, description: newDesc, vectorDb: newVectorDb,
      embeddingModel: newEmbedding, chunkSize: newChunkSize, chunkOverlap: newChunkOverlap,
      documents: 0, chunks: 0, status: 'draft', lastSync: 'Nunca', owner: 'Você',
    };
    setKbs(prev => [kb, ...prev]);
    setShowCreate(false);
    setNewName(''); setNewDesc('');
    toast.success(`Base "${newName}" criada`);
  }, [newName, newDesc, newVectorDb, newEmbedding, newChunkSize, newChunkOverlap]);

  const deleteKb = useCallback((id: string) => {
    if (!confirm('Excluir esta base de conhecimento e todos os documentos?')) return;
    setKbs(prev => prev.filter(k => k.id !== id));
    toast.info('Base excluída');
  }, []);

  const syncKb = useCallback((id: string) => {
    setKbs(prev => prev.map(k => k.id === id ? { ...k, status: 'syncing' as const } : k));
    toast.info('Sync iniciado...');
    setTimeout(() => {
      setKbs(prev => prev.map(k => k.id === id ? { ...k, status: 'production' as const, lastSync: new Date().toLocaleString('pt-BR') } : k));
      toast.success('Sync concluído');
    }, 2000 + Math.random() * 2000);
  }, []);

  const uploadDocuments = useCallback(async (kbId: string, files: FileList) => {
    const count = files.length;
    toast.info(`Processando ${count} arquivo(s)...`);
    let totalChunks = 0;
    const kb = kbs.find(k => k.id === kbId);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();

      // Try Edge Function first (real embeddings via OpenAI)
      const edgeResult = await edgeFunctions.ragIngest({
        knowledge_base_id: kbId,
        document_name: file.name,
        content,
        chunk_size: kb?.chunkSize ?? 512,
        chunk_overlap: kb?.chunkOverlap ?? 50,
        embedding_model: kb?.embeddingModel ?? 'text-embedding-3-small',
      });

      if (!edgeResult.error && edgeResult.data) {
        totalChunks += edgeResult.data.chunks_created;
        toast.info(`${file.name}: ${edgeResult.data.chunks_created} chunks + ${edgeResult.data.embeddings_generated} embeddings (Edge Function)`);
      } else {
        // Fallback: local RAG pipeline (no real embeddings)
        const result = await ragPipeline.ingestDocument(file, kbId, { chunkSize: kb?.chunkSize, chunkOverlap: kb?.chunkOverlap }, (stage) => toast.info(`${file.name}: ${stage}`));
        if (result.error) { toast.error(`${file.name}: ${result.error}`); continue; }
        totalChunks += result.chunks;
      }
    }

    setKbs(prev => prev.map(k => k.id === kbId ? { ...k, documents: k.documents + count, chunks: k.chunks + totalChunks } : k));
    toast.success(`${count} arquivo(s) processados — ${totalChunks} chunks criados`);
    setShowUpload(null);
  }, [kbs]);

  const updateConfig = useCallback((kbId: string, updates: Partial<KnowledgeBase>) => {
    setKbs(prev => prev.map(k => k.id === kbId ? { ...k, ...updates } : k));
    toast.success('Configuração atualizada');
  }, []);

  const filtered = kbs.filter(k => !searchQuery || k.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Knowledge / RAG"
        description="Gerencie bases de conhecimento, documentos e pipelines de ingestão"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Nova base</Button>}
      />

      <InfoHint title="O que é RAG?">
        Retrieval-Augmented Generation combina busca em documentos com geração de linguagem. O agente recupera trechos relevantes antes de responder.
      </InfoHint>

      {/* Pipeline visual */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Pipeline de ingestão</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2 shrink-0">
              <div className="px-4 py-2 rounded-xl border border-border bg-card text-xs text-foreground whitespace-nowrap">{step}</div>
              {i < PIPELINE_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar bases..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
      </div>

      {/* Knowledge bases grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(kb => (
          <div key={kb.id} className="nexus-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><BookOpen className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{kb.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{kb.vectorDb} • {kb.embeddingModel.split('-').slice(-1)}</p>
                </div>
              </div>
              <StatusBadge status={kb.status} />
            </div>
            <p className="text-xs text-muted-foreground mb-3">{kb.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center border-t border-border/50 pt-3">
              <div><p className="text-lg font-heading font-bold text-foreground">{kb.documents}</p><p className="text-[10px] text-muted-foreground">Docs</p></div>
              <div><p className="text-lg font-heading font-bold text-foreground">{kb.chunks.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Chunks</p></div>
              <div><p className="text-[10px] text-muted-foreground">Chunk Size</p><p className="text-xs font-mono text-foreground">{kb.chunkSize}</p></div>
            </div>

            {/* Config panel */}
            {showConfig === kb.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-muted-foreground">Vector DB</label>
                    <select value={kb.vectorDb} onChange={e => updateConfig(kb.id, { vectorDb: e.target.value })} className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-[10px] text-foreground">
                      {VECTOR_DBS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div><label className="text-[10px] text-muted-foreground">Embedding Model</label>
                    <select value={kb.embeddingModel} onChange={e => updateConfig(kb.id, { embeddingModel: e.target.value })} className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-[10px] text-foreground">
                      {EMBEDDING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div><label className="text-[10px] text-muted-foreground">Chunk Size</label>
                    <input type="number" value={kb.chunkSize} onChange={e => updateConfig(kb.id, { chunkSize: Number(e.target.value) })} className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono" />
                  </div>
                  <div><label className="text-[10px] text-muted-foreground">Overlap %</label>
                    <input type="number" value={kb.chunkOverlap} onChange={e => updateConfig(kb.id, { chunkOverlap: Number(e.target.value) })} className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono" />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-1 mt-3 pt-3 border-t border-border/50">
              <label className="flex-1">
                <input type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.docx" className="hidden" onChange={e => { if (e.target.files?.length) uploadDocuments(kb.id, e.target.files); e.target.value = ''; }} />
                <span className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-border text-[10px] text-foreground hover:bg-muted/30 cursor-pointer"><Upload className="h-3 w-3" /> Upload</span>
              </label>
              <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7 gap-1" onClick={() => setShowConfig(showConfig === kb.id ? null : kb.id)}><Settings className="h-3 w-3" /> Config</Button>
              <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7 gap-1" disabled={kb.status === 'syncing'} onClick={() => syncKb(kb.id)}>
                <RefreshCw className={`h-3 w-3 ${kb.status === 'syncing' ? 'animate-spin' : ''}`} /> Sync
              </Button>
              <button onClick={() => deleteKb(kb.id)} className="p-1 rounded hover:bg-destructive/20"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">{kb.owner} • Sync: {kb.lastSync}</p>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="nexus-card text-center py-8 col-span-full">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma base encontrada</p>
          </div>
        )}
      </div>

      {/* RAG Quality */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Qualidade RAG — Panorama</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Recall', value: '87.3%', color: 'text-emerald-400' },
            { label: 'Precision', value: '91.5%', color: 'text-emerald-400' },
            { label: 'Freshness', value: '94.0%', color: 'text-emerald-400' },
            { label: 'Coverage', value: '78.2%', color: 'text-amber-400' },
            { label: 'Citation', value: '85.0%', color: 'text-primary' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className={`text-2xl font-heading font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Nova Base de Conhecimento</h3><button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Nome *</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Políticas de RH" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1" /></div>
              <div><label className="text-xs text-muted-foreground">Descrição</label><textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="O que esta base contém..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1 h-16 resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Vector DB</label><select value={newVectorDb} onChange={e => setNewVectorDb(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground mt-1">{VECTOR_DBS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label className="text-xs text-muted-foreground">Embedding Model</label><select value={newEmbedding} onChange={e => setNewEmbedding(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground mt-1">{EMBEDDING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="text-xs text-muted-foreground">Chunk Size (tokens)</label><input type="number" value={newChunkSize} onChange={e => setNewChunkSize(Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground mt-1 font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Overlap %</label><input type="number" value={newChunkOverlap} onChange={e => setNewChunkOverlap(Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground mt-1 font-mono" /></div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button size="sm" onClick={createKb} className="gap-1"><Save className="h-3.5 w-3.5" /> Criar Base</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
