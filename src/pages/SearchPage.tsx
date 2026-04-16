import { useState } from "react";
import { Search, Loader2, FileText, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { VisualSearchButton } from "@/components/search/VisualSearchButton";
import {
  semanticSearch,
  type SemanticSearchResult,
  type VisualSearchResponse,
} from "@/services/searchService";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [imageDescription, setImageDescription] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const runSearch = async () => {
    if (query.trim().length < 2) {
      toast.error("Digite pelo menos 2 caracteres");
      return;
    }
    setLoading(true);
    setImageDescription(null);
    try {
      const r = await semanticSearch(query, { topK: 15 });
      setResults(r.results);
      setCached(r.cached);
      if (r.results.length === 0) {
        toast.info("Nenhum resultado encontrado");
      }
    } catch (e) {
      toast.error("Falha na busca", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVisual = (resp: VisualSearchResponse) => {
    setImageDescription(resp.description);
    setResults(resp.results);
    setQuery(resp.description);
    setCached(false);
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
          Busca Inteligente
        </h1>
        <p className="text-muted-foreground">
          Busca semântica e visual sobre toda a base de conhecimento.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Pergunte algo ou descreva o que procura…"
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button onClick={runSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="ml-2">Buscar</span>
            </Button>
            <VisualSearchButton onResults={handleVisual} topK={15} />
          </div>

          {imageDescription && (
            <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm">
              <span className="font-medium text-muted-foreground">
                Descrição da imagem:
              </span>{" "}
              <span>{imageDescription}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Resultados {results.length > 0 && (
              <span className="text-muted-foreground">({results.length})</span>
            )}
          </h2>
          {cached && (
            <Badge variant="outline" className="text-xs">
              cache hit
            </Badge>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <Search className="h-10 w-10 opacity-40" />
              <p>Nenhum resultado ainda. Faça uma busca acima.</p>
            </CardContent>
          </Card>
        )}

        {!loading &&
          results.map((r) => (
            <Card key={r.chunk_id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    {r.document_title ?? "Documento sem título"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={r.matched_via === "vector" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {r.matched_via}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {(r.similarity * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {r.content}
                </p>
                {r.source_url && (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir fonte
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
      </section>
    </div>
  );
}
