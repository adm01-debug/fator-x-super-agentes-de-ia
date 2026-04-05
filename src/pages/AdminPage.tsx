import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, RefreshCw, Loader2, Database, Bot, Activity, BookOpen, FileText, History, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type TableName = "agents" | "agent_traces" | "knowledge_bases" | "prompt_versions" | "evaluation_runs" | "oracle_history";

const TABLE_CONFIG: { key: TableName; label: string; icon: React.ElementType; columns: { key: string; label: string }[] }[] = [
  {
    key: "agents", label: "Agentes", icon: Bot,
    columns: [
      { key: "name", label: "Nome" },
      { key: "model", label: "Modelo" },
      { key: "status", label: "Status" },
      { key: "version", label: "Versão" },
      { key: "updated_at", label: "Atualizado" },
    ],
  },
  {
    key: "agent_traces", label: "Traces", icon: Activity,
    columns: [
      { key: "event", label: "Evento" },
      { key: "level", label: "Nível" },
      { key: "latency_ms", label: "Latência (ms)" },
      { key: "tokens_used", label: "Tokens" },
      { key: "created_at", label: "Data" },
    ],
  },
  {
    key: "knowledge_bases", label: "Knowledge Bases", icon: BookOpen,
    columns: [
      { key: "name", label: "Nome" },
      { key: "vector_db", label: "Vector DB" },
      { key: "document_count", label: "Docs" },
      { key: "chunk_count", label: "Chunks" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "prompt_versions", label: "Prompt Versions", icon: FileText,
    columns: [
      { key: "version", label: "Versão" },
      { key: "change_summary", label: "Resumo" },
      { key: "is_active", label: "Ativo" },
      { key: "created_at", label: "Data" },
    ],
  },
  {
    key: "evaluation_runs", label: "Avaliações", icon: Eye,
    columns: [
      { key: "name", label: "Nome" },
      { key: "status", label: "Status" },
      { key: "test_cases", label: "Casos" },
      { key: "pass_rate", label: "Taxa" },
      { key: "created_at", label: "Data" },
    ],
  },
  {
    key: "oracle_history", label: "Oracle History", icon: History,
    columns: [
      { key: "query", label: "Query" },
      { key: "mode", label: "Modo" },
      { key: "models_used", label: "Modelos" },
      { key: "total_tokens", label: "Tokens" },
      { key: "created_at", label: "Data" },
    ],
  },
];

function formatCell(value: unknown, key: string): string {
  if (value === null || value === undefined) return "—";
  if (key.includes("_at") || key === "created_at" || key === "updated_at") {
    try { return format(new Date(String(value)), "dd/MM/yy HH:mm"); } catch (err) { console.error("Operation failed:", err); return String(value); }
  }
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
  const str = String(value);
  return str.length > 80 ? str.slice(0, 77) + "…" : str;
}

function AdminTable({ config }: { config: typeof TABLE_CONFIG[0] }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["admin", config.key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(config.key)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = rows.filter((row: Record<string, unknown>) =>
    config.columns.some(col => {
      const val = row[col.key];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    })
  );

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from(config.key).delete().eq("id", id);
    if (error) {
      toast.error(`Erro ao deletar: ${error.message}`);
    } else {
      toast.success("Registro removido");
      refetch();
      queryClient.invalidateQueries({ queryKey: [config.key] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${config.label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        <Badge variant="secondary" className="text-xs">
          {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  {config.columns.map((col) => (
                    <TableHead key={col.key} className="text-xs font-semibold whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs font-semibold w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row: Record<string, unknown>) => (
                  <TableRow key={String(row.id)} className="hover:bg-secondary/20">
                    {config.columns.map((col) => (
                      <TableCell key={col.key} className="text-xs py-2.5 max-w-[200px] truncate">
                        {col.key === "status" || col.key === "level" ? (
                          <Badge variant="outline" className="text-[11px]">
                            {formatCell(row[col.key], col.key)}
                          </Badge>
                        ) : col.key === "is_active" ? (
                          <span className={row[col.key] ? "text-nexus-emerald" : "text-muted-foreground"}>
                            {row[col.key] ? "✓ Ativo" : "Inativo"}
                          </span>
                        ) : (
                          formatCell(row[col.key], col.key)
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="py-2.5">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Este registro será removido permanentemente. Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(String(row.id))}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Administração do Banco"
        description="Visualize e gerencie todos os dados do sistema — CRUD completo"
      />

      <div>
        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1 p-1">
            {TABLE_CONFIG.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABLE_CONFIG.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <AdminTable config={t} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
