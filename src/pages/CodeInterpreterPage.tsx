import { useEffect, useState } from "react";
import { Terminal, Play, FileCode2, Package, Trash2, History, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";
import { codeInterpreterService, type CodeExecution, type CodeRuntime } from "@/services/codeInterpreterService";

const SNIPPETS: Record<CodeRuntime, { label: string; code: string }[]> = {
  deno: [
    { label: "Hello", code: 'console.log("Olá do sandbox Deno real!");' },
    { label: "Fibonacci", code: 'const fib = (n: number): number => n < 2 ? n : fib(n-1) + fib(n-2);\nconsole.log([...Array(10)].map((_, i) => fib(i)).join(", "));' },
    { label: "JSON", code: 'const data = { name: "Nexus", year: 2026 };\nconsole.log(JSON.stringify(data, null, 2));' },
  ],
  python: [
    { label: "Hello", code: 'print("Olá do sandbox virtual Python!")' },
    { label: "Pandas", code: 'import pandas as pd\ndf = pd.DataFrame({"x": [1,2,3], "y": [4,5,6]})\nprint(df.describe())' },
    { label: "Plot", code: 'import matplotlib.pyplot as plt\nplt.plot([1,2,3,4],[1,4,9,16])\nplt.savefig("/tmp/plot.png")\nprint("saved")' },
  ],
  node: [
    { label: "Hello", code: 'console.log("Olá do sandbox virtual Node!");' },
    { label: "Map", code: 'const xs = [1,2,3,4,5];\nconsole.log(xs.map(x => x * x));' },
    { label: "Fetch", code: 'const r = await fetch("https://api.github.com");\nconsole.log(r.status);' },
  ],
};

export default function CodeInterpreterPage() {
  const [code, setCode] = useState(SNIPPETS.deno[0].code);
  const [runtime, setRuntime] = useState<CodeRuntime>("deno");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<CodeExecution[]>([]);
  const [current, setCurrent] = useState<CodeExecution | null>(null);

  const loadHistory = async () => {
    try {
      const list = await codeInterpreterService.list();
      setHistory(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const run = async () => {
    if (!code.trim()) { toast.error("Código vazio"); return; }
    setRunning(true);
    setCurrent(null);
    try {
      const result = await codeInterpreterService.execute(runtime, code);
      setCurrent(result);
      setHistory((prev) => [result, ...prev].slice(0, 20));
      toast.success(result.simulated ? "Execução simulada concluída" : "Execução real concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na execução");
    } finally {
      setRunning(false);
    }
  };

  const clearHistory = async () => {
    try {
      await codeInterpreterService.clearAll();
      setHistory([]);
      toast.success("Histórico limpo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao limpar");
    }
  };

  const replay = (exec: CodeExecution) => {
    setRuntime(exec.runtime);
    setCode(exec.code);
    setCurrent(exec);
  };

  const isReal = runtime === "deno";

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Code Interpreter"
        description="Sandbox para execução de código. Deno roda nativo isolado; Python/Node são simulados via análise estática (LLM)."
      />

      <div className="flex items-center gap-2 flex-wrap">
        {(["deno", "python", "node"] as const).map((r) => (
          <button key={r} onClick={() => { setRuntime(r); setCode(SNIPPETS[r][0].code); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${runtime === r ? "border-primary bg-primary/10" : "border-border/40 hover:border-border"}`}>
            {r === "deno" && "🦕 Deno (real)"}
            {r === "python" && "🐍 Python (simulado)"}
            {r === "node" && "⬢ Node (simulado)"}
          </button>
        ))}
        <div className="flex-1" />
        <Badge variant={isReal ? "default" : "outline"} className="text-[10px]">
          {isReal ? "Sandbox real · timeout 30s" : "Simulação determinística via LLM"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileCode2 className="h-4 w-4" />Código</CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SNIPPETS[runtime].map((s) => (
                <Button key={s.label} size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setCode(s.code)}>
                  <Sparkles className="h-3 w-3 mr-1" />{s.label}
                </Button>
              ))}
              <Button size="sm" onClick={run} disabled={running}>
                {running ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Executando</> : <><Play className="h-3.5 w-3.5 mr-1" />Executar</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-xs min-h-[280px] bg-muted/20" spellCheck={false} />

            <Tabs defaultValue="stdout">
              <TabsList>
                <TabsTrigger value="stdout">stdout</TabsTrigger>
                <TabsTrigger value="stderr">stderr</TabsTrigger>
                <TabsTrigger value="files"><Package className="h-3 w-3 mr-1" />Arquivos</TabsTrigger>
                <TabsTrigger value="meta">Métricas</TabsTrigger>
              </TabsList>
              <TabsContent value="stdout">
                <pre className="text-xs bg-muted/30 p-4 rounded font-mono whitespace-pre-wrap min-h-[180px] max-h-[300px] overflow-auto">
                  {current?.stdout || (running ? "▶ Executando..." : "Sem saída ainda")}
                </pre>
              </TabsContent>
              <TabsContent value="stderr">
                <pre className="text-xs bg-destructive/5 text-destructive p-4 rounded font-mono whitespace-pre-wrap min-h-[180px] max-h-[300px] overflow-auto">
                  {current?.stderr || "Sem erros"}
                </pre>
              </TabsContent>
              <TabsContent value="files">
                {current?.files && current.files.length > 0 ? (
                  <div className="space-y-1.5">
                    {current.files.map((f, i) => (
                      <div key={i} className="p-2.5 bg-muted/30 rounded flex items-center justify-between text-xs">
                        <span className="font-mono">{f.name}</span>
                        <Badge variant="outline" className="text-[10px]">{(f.size / 1024).toFixed(1)} KB</Badge>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center text-xs text-muted-foreground py-12">Sem arquivos gerados</div>}
              </TabsContent>
              <TabsContent value="meta">
                {current ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-muted/30 rounded"><span className="text-muted-foreground">Status:</span> <span className="font-medium">{current.status}</span></div>
                    <div className="p-2.5 bg-muted/30 rounded"><span className="text-muted-foreground">Exit code:</span> <span className="font-mono">{current.exit_code ?? "—"}</span></div>
                    <div className="p-2.5 bg-muted/30 rounded"><span className="text-muted-foreground">Duração:</span> <span className="font-mono">{current.duration_ms} ms</span></div>
                    <div className="p-2.5 bg-muted/30 rounded"><span className="text-muted-foreground">Memória:</span> <span className="font-mono">{current.memory_mb} MB</span></div>
                    {current.simulated && (
                      <div className="col-span-2 p-2.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Resultado simulado por LLM. Para execução real de Python/Node, configure E2B ou Daytona.</span>
                      </div>
                    )}
                  </div>
                ) : <div className="text-center text-xs text-muted-foreground py-12">Sem execução</div>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Histórico</CardTitle>
            {history.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearHistory} className="h-7 text-[11px] text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3 mr-1" />Limpar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[560px] pr-2">
              {history.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-12">
                  <Terminal className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  Sem execuções
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <button key={h.id} onClick={() => replay(h)}
                      className={`w-full text-left p-2.5 rounded border transition-all hover:border-primary/40 ${current?.id === h.id ? "border-primary bg-primary/5" : "border-border/40 bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[9px] uppercase">{h.runtime}</Badge>
                        <span className={`text-[10px] ${h.status === "completed" ? "text-emerald-500" : "text-destructive"}`}>{h.status}</span>
                      </div>
                      <pre className="text-[10px] font-mono text-muted-foreground truncate">{h.code.split("\n")[0].slice(0, 50)}</pre>
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{h.duration_ms}ms</span>
                        <span>·</span>
                        <span>{new Date(h.created_at).toLocaleTimeString("pt-BR")}</span>
                        {h.simulated && <Badge variant="outline" className="text-[8px] ml-auto">sim</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
