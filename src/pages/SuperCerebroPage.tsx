import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Search, Network, Loader2, Sparkles, BookOpen, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const knowledgeAreas = [
  { icon: '📋', title: 'Processos & SOPs', desc: 'Procedimentos operacionais padrão da empresa', docs: 0 },
  { icon: '📊', title: 'Relatórios & Dados', desc: 'Relatórios financeiros, KPIs e dashboards', docs: 0 },
  { icon: '👥', title: 'RH & Pessoas', desc: 'Políticas de RH, benefícios e cultura', docs: 0 },
  { icon: '💰', title: 'Financeiro', desc: 'Orçamentos, projeções e fluxo de caixa', docs: 0 },
  { icon: '🏭', title: 'Fornecedores', desc: 'Catálogo, preços e avaliações de fornecedores', docs: 0 },
  { icon: '🛒', title: 'Produtos & Catálogo', desc: 'Produtos, especificações e preços', docs: 0 },
  { icon: '📞', title: 'Clientes & CRM', desc: 'Base de clientes, histórico e segmentação', docs: 0 },
  { icon: '⚖️', title: 'Jurídico & Compliance', desc: 'Contratos, termos e regulamentações', docs: 0 },
];

export default function SuperCerebroPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('cerebro-query', {
        body: { query, mode: 'chat' },
      });
      if (error) throw error;
      const meta = [];
      if (data?.facts_loaded > 0) meta.push(`${data.facts_loaded} fatos carregados`);
      if (data?.rag_chunks_used) meta.push('RAG ativo');
      if (data?.rules_loaded) meta.push('Regras de negócio carregadas');
      const metaLine = meta.length > 0 ? `\n\n---\n_${meta.join(' • ')} • Custo: $${data?.cost_usd?.toFixed(6) || '0'}_` : '';
      setSearchResults((data?.response || 'Sem resposta') + metaLine);
    } catch (e: unknown) {
      toast.error(e.message || 'Erro na consulta');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader title="🧠 Super Cérebro" description="Enterprise Memory Layer — Memória centralizada da empresa" />

      <InfoHint title="O que é o Super Cérebro?">
        O Super Cérebro é a camada de memória empresarial que conecta todos os agentes. Ele armazena conhecimento institucional, processos, dados de clientes e fornecedores — permitindo que qualquer agente acesse informações da empresa.
      </InfoHint>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-1.5"><Search className="h-3.5 w-3.5" /> Consultar</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Áreas</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Áreas de conhecimento', value: knowledgeAreas.length, icon: '📂' },
              { label: 'Documentos', value: '0', icon: '📄' },
              { label: 'Consultas hoje', value: '—', icon: '🔍' },
              { label: 'Agentes conectados', value: '—', icon: '🤖' },
            ].map(m => (
              <div key={m.label} className="nexus-card text-center py-4">
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className="text-xl font-heading font-bold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> Arquitetura de Memória
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: '💾', title: 'Memória Semântica', desc: 'Embeddings vetoriais de documentos e conhecimento', status: 'active' },
                { icon: '🕸️', title: 'Grafo de Conhecimento', desc: 'Relações entre entidades, pessoas e conceitos', status: 'active' },
                { icon: '🔄', title: 'Sync Contínuo', desc: 'Atualização automática via Edge Function cerebro-query', status: 'active' },
              ].map(l => (
                <div key={l.title} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{l.icon}</span>
                    <span className="text-xs font-semibold text-foreground">{l.title}</span>
                    <Badge variant="outline" className={`text-[9px] ml-auto ${l.status === 'active' ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'}`}>
                      {l.status === 'active' ? 'Ativo' : 'Planejado'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{l.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Search / Query */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Consultar o Super Cérebro
            </h3>
            <div className="flex gap-2">
              <Textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Pergunte ao Super Cérebro... Ex: Quais são nossos principais fornecedores?"
                className="bg-secondary/50 min-h-[80px] text-sm"
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-muted-foreground">Consulta semântica ao conhecimento da empresa</p>
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isSearching ? 'Buscando...' : '🧠 Consultar'}
              </Button>
            </div>
            {searchResults && (
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                <p className="text-xs font-semibold text-foreground mb-2">Resposta do Super Cérebro:</p>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{searchResults}</div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Knowledge Areas */}
        <TabsContent value="knowledge" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {knowledgeAreas.map((area) => (
              <div key={area.title} className="nexus-card cursor-pointer hover:border-primary/30 transition-colors">
                <div className="text-3xl mb-3">{area.icon}</div>
                <h3 className="text-sm font-semibold text-foreground">{area.title}</h3>
                <p className="text-[10px] text-muted-foreground mt-1 mb-3">{area.desc}</p>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground">{area.docs} documentos</span>
                  <Badge variant="outline" className="text-[9px]">Configurar</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
