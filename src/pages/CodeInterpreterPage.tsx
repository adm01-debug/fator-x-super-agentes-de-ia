import { useState } from "react";
import { Terminal, Play, Square, Download, FileCode2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

const SAMPLE_CODE = `import pandas as pd
import matplotlib.pyplot as plt

df = pd.DataFrame({
    'mes': ['Jan', 'Fev', 'Mar', 'Abr'],
    'vendas': [142580, 168920, 201450, 187300]
})

print(df.describe())
df.plot.bar(x='mes', y='vendas', color='#6366f1')
plt.title('Vendas Mensais 2026')
plt.savefig('/tmp/chart.png')`;

export default function CodeInterpreterPage() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [runtime, setRuntime] = useState<"python" | "node" | "deno">("python");
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setOutput("");
    await new Promise((r) => setTimeout(r, 1200));
    setOutput(`           vendas
count       4.000
mean   175062.500
std     25147.821
min    142580.000
max    201450.000

[Saved] /tmp/chart.png (12.4 KB)
✓ Execução concluída em 847ms`);
    setRunning(false);
    toast.success("Código executado no sandbox");
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Code Interpreter"
        description="Sandbox isolado (Firecracker microVM) para execução de Python, Node.js e Deno. Acesso a 200+ libs científicas."
      />

      <div className="flex items-center gap-2">
        {(["python", "node", "deno"] as const).map((r) => (
          <button key={r} onClick={() => setRuntime(r)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${runtime === r ? "border-primary bg-primary/10" : "border-border/40"}`}>
            {r === "python" && "🐍 Python 3.12"}
            {r === "node" && "⬢ Node.js 20"}
            {r === "deno" && "🦕 Deno 2"}
          </button>
        ))}
        <div className="flex-1" />
        <Badge variant="outline" className="text-[10px]">Sandbox: 1GB RAM · 30s timeout</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><FileCode2 className="h-4 w-4" />Código</CardTitle>
            <Button size="sm" onClick={run} disabled={running}>
              {running ? <><Square className="h-3.5 w-3.5 mr-1" />Parar</> : <><Play className="h-3.5 w-3.5 mr-1" />Executar</>}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-xs min-h-[400px] bg-muted/20" spellCheck={false} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4" />Output</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="stdout">
              <TabsList>
                <TabsTrigger value="stdout">stdout</TabsTrigger>
                <TabsTrigger value="files">Arquivos</TabsTrigger>
                <TabsTrigger value="packages"><Package className="h-3 w-3 mr-1" />Packages</TabsTrigger>
              </TabsList>
              <TabsContent value="stdout">
                <pre className="text-xs bg-muted/30 p-4 rounded font-mono whitespace-pre-wrap min-h-[380px]">
                  {output || (running ? "▶ Executando..." : "Aguardando execução...")}
                </pre>
              </TabsContent>
              <TabsContent value="files">
                {output ? (
                  <div className="p-3 bg-muted/30 rounded flex items-center justify-between text-sm">
                    <span className="font-mono">/tmp/chart.png</span>
                    <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" />Baixar</Button>
                  </div>
                ) : <div className="text-center text-sm text-muted-foreground py-12">Sem arquivos gerados</div>}
              </TabsContent>
              <TabsContent value="packages">
                <div className="space-y-1.5 text-xs">
                  {["pandas 2.2.0", "numpy 1.26.3", "matplotlib 3.8.2", "scipy 1.12.0", "scikit-learn 1.4.0", "requests 2.31.0", "pillow 10.2.0"].map((p) => (
                    <div key={p} className="p-2 bg-muted/30 rounded font-mono">{p}</div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
