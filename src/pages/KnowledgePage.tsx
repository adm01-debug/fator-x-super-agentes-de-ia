import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { knowledgeBases } from "@/lib/mock-data";
import { Plus, Search, BookOpen, FileText, Database, RefreshCw, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const pipeline = ['Parsing', 'Chunking', 'Metadata', 'Embeddings', 'Indexing'];

export default function KnowledgePage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Knowledge / RAG"
        description="Gerencie bases de conhecimento, documentos e pipelines de ingestão"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Nova base</Button>}
      />

      <InfoHint title="O que é RAG?">
        Retrieval-Augmented Generation combina busca em documentos com geração de linguagem. O agente recupera trechos relevantes da base de conhecimento antes de responder, melhorando a factualidade e permitindo citações.
      </InfoHint>

      {/* Pipeline visual */}
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
          <Input placeholder="Buscar bases..." className="pl-9 bg-secondary/50 border-border/50" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {knowledgeBases.map((kb, i) => (
          <motion.div key={kb.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="nexus-card cursor-pointer group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{kb.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{kb.vectorDb} • {kb.embeddingModel.split('-').slice(-1)}</p>
                </div>
              </div>
              <StatusBadge status={kb.status} />
            </div>
            <p className="text-xs text-muted-foreground mb-4">{kb.description}</p>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border/50 pt-3">
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{kb.documents}</p>
                <p className="text-[10px] text-muted-foreground">Docs</p>
              </div>
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{kb.chunks.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Chunks</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mt-1">Última sync</p>
                <p className="text-[11px] font-medium text-foreground">{kb.lastSync.includes('Nunca') ? 'Nunca' : kb.lastSync.split(' ')[1]}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">{kb.owner}</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                <RefreshCw className="h-3 w-3" /> Sync
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* RAG Quality */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Qualidade RAG — Panorama</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Recall', value: '87.3%', color: 'text-nexus-emerald' },
            { label: 'Precision', value: '91.5%', color: 'text-nexus-emerald' },
            { label: 'Freshness', value: '94.0%', color: 'text-nexus-emerald' },
            { label: 'Coverage', value: '78.2%', color: 'text-nexus-amber' },
            { label: 'Citation', value: '85.0%', color: 'text-nexus-cyan' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className={`text-2xl font-heading font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
