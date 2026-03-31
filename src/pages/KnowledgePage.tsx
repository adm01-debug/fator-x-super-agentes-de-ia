import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, ArrowRight, Loader2, Database } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreateKnowledgeBaseDialog } from "@/components/dialogs/CreateKnowledgeBaseDialog";

const pipeline = ['Parsing', 'Chunking', 'Metadata', 'Embeddings', 'Indexing'];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");

  const { data: knowledgeBases = [], isLoading, refetch } = useQuery({
    queryKey: ['knowledge_bases'],
    queryFn: async () => {
      const { data, error } = await supabase.from('knowledge_bases').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Knowledge / RAG"
        description="Gerencie bases de conhecimento, documentos e pipelines de ingestão"
        actions={<CreateKnowledgeBaseDialog onCreated={() => refetch()} />}
      />

      <InfoHint title="O que é RAG?">
        Retrieval-Augmented Generation combina busca em documentos com geração de linguagem. O agente recupera trechos relevantes da base de conhecimento antes de responder, melhorando a factualidade e permitindo citações.
      </InfoHint>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Pipeline de ingestão</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {pipeline.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">{i + 1}</div>
                <p className="text-[11px] text-foreground mt-1.5 font-medium">{step}</p>
              </div>
              {i < pipeline.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar bases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma base de conhecimento</h2>
          <p className="text-sm text-muted-foreground mb-4">Crie uma base para alimentar seus agentes com RAG.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((kb, i) => (
            <motion.div key={kb.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="nexus-card cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{kb.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{kb.vector_db} • {kb.embedding_model?.split('-').slice(-1)}</p>
                  </div>
                </div>
                <StatusBadge status={kb.status || 'active'} />
              </div>
              <p className="text-xs text-muted-foreground mb-4">{kb.description || 'Sem descrição'}</p>
              <div className="grid grid-cols-2 gap-2 text-center border-t border-border/50 pt-3">
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">{kb.document_count ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Docs</p>
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">{(kb.chunk_count ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Chunks</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
