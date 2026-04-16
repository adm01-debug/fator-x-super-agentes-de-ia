import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, Search, Plus, GitBranch } from "lucide-react";
import { toast } from "sonner";

interface Entity { id: string; label: string; type: string; connections: number }
interface Relation { from: string; to: string; type: string }

const entities: Entity[] = [
  { id: "e1", label: "Promo Brindes", type: "Empresa", connections: 12 },
  { id: "e2", label: "João Silva", type: "Pessoa", connections: 5 },
  { id: "e3", label: "Pedido #4521", type: "Transação", connections: 3 },
  { id: "e4", label: "Caneca Personalizada", type: "Produto", connections: 8 },
  { id: "e5", label: "São Paulo", type: "Localidade", connections: 47 },
];

const relations: Relation[] = [
  { from: "Promo Brindes", to: "Pedido #4521", type: "EMITIU" },
  { from: "João Silva", to: "Pedido #4521", type: "COMPROU" },
  { from: "Pedido #4521", to: "Caneca Personalizada", type: "CONTÉM" },
  { from: "João Silva", to: "São Paulo", type: "RESIDE_EM" },
];

export default function KnowledgeGraphPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Network className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Knowledge Graph
          </h1>
        </div>
        <p className="text-muted-foreground">
          Grafo de entidades e relações — busca semântica estrutural além de RAG vetorial. Cypher-like queries.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Entidades</p><p className="text-2xl font-bold">2.847</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Relações</p><p className="text-2xl font-bold">8.512</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Tipos</p><p className="text-2xl font-bold">14</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Densidade</p><p className="text-2xl font-bold">2.99</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query Cypher</CardTitle>
          <CardDescription>Ex: MATCH (p:Pessoa)-[:COMPROU]-&gt;(o:Pedido) RETURN p, o LIMIT 10</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="MATCH (n) RETURN n LIMIT 25" value={query} onChange={e => setQuery(e.target.value)} className="font-mono" />
            <Button onClick={() => toast.success("Query executada — 25 nós retornados")}><Search className="h-4 w-4 mr-2" />Executar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Entidades</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {entities.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/40 transition-colors">
                <div>
                  <p className="font-semibold">{e.label}</p>
                  <Badge variant="secondary" className="text-xs">{e.type}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4" />{e.connections}
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => toast.info("Abrindo formulário de entidade")}><Plus className="h-4 w-4 mr-2" />Adicionar entidade</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Relações Recentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {relations.map((r, i) => (
              <div key={i} className="p-3 border border-border rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{r.from}</span>
                  <Badge variant="outline" className="text-xs">{r.type}</Badge>
                  <span className="font-semibold">{r.to}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
