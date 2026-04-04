import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SearchTab() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('cerebro-query', {
        body: { query, mode: 'chat' },
      });
      if (error) throw error;
      const meta: string[] = [];
      if (data?.facts_loaded > 0) meta.push(`${data.facts_loaded} fatos`);
      if (data?.rag_chunks_used) meta.push(data.rag_reranked ? 'RAG reranked' : 'RAG ativo');
      if (data?.external_facts > 0) meta.push(`${data.external_facts} fatos externos`);
      const metaLine = meta.length > 0 ? `\n\n---\n_${meta.join(' • ')} • Custo: $${data?.cost_usd?.toFixed(6) || '0'}_` : '';
      setSearchResults((data?.response || 'Sem resposta') + metaLine);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro na consulta');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="nexus-card space-y-4">
      <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" /> Consultar o Super Cérebro
      </h3>
      <Textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Pergunte ao Super Cérebro... Ex: Quais são nossos principais fornecedores?"
        className="bg-secondary/50 min-h-[80px] text-sm"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
      />
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-muted-foreground">Consulta semântica ao conhecimento da empresa (fatos + RAG + bancos externos)</p>
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
  );
}
