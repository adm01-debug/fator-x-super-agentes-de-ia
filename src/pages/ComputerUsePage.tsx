import { useState } from "react";
import { Monitor, MousePointer2, Keyboard, Camera, Play, Square, FastForward, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Action = { type: "click" | "type" | "screenshot" | "scroll" | "wait"; target?: string; text?: string; ts: string; status: "ok" | "pending" | "error" };

const PRESETS = [
  { title: "Preencher formulário", desc: "Navega até o site, preenche e submete" },
  { title: "Extrair dados de tabela", desc: "Lê tabelas HTML e exporta CSV" },
  { title: "Fluxo de checkout", desc: "E2E de carrinho até pagamento" },
  { title: "Capturar relatório", desc: "Login, navega ao dashboard e baixa PDF" },
];

export default function ComputerUsePage() {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [model, setModel] = useState("claude-sonnet-4");

  const runTask = async () => {
    if (!task.trim()) return;
    setRunning(true);
    setActions([]);
    const seq: Action[] = [
      { type: "screenshot", ts: new Date().toISOString(), status: "ok" },
      { type: "click", target: "input[name='email']", ts: new Date().toISOString(), status: "ok" },
      { type: "type", target: "input[name='email']", text: "demo@fatorx.app", ts: new Date().toISOString(), status: "ok" },
      { type: "click", target: "button[type='submit']", ts: new Date().toISOString(), status: "ok" },
      { type: "wait", ts: new Date().toISOString(), status: "ok" },
      { type: "screenshot", ts: new Date().toISOString(), status: "ok" },
    ];
    for (const a of seq) {
      await new Promise((r) => setTimeout(r, 600));
      setActions((prev) => [...prev, a]);
    }
    setRunning(false);
    toast.success("Tarefa concluída", { description: `${seq.length} ações executadas com ${model}` });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Computer Use"
        description="Agente que opera o navegador como humano — clica, digita, lê screenshots. Inspirado em Anthropic Computer Use API."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" />Browser virtual</CardTitle></CardHeader>
            <CardContent>
              <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted/20 rounded-md border border-border/40 flex items-center justify-center relative overflow-hidden">
                {running ? (
                  <>
                    <div className="absolute inset-0 bg-grid-pattern opacity-10" />
                    <div className="text-center z-10">
                      <Camera className="h-10 w-10 mx-auto text-primary animate-pulse" />
                      <div className="text-sm mt-2 font-medium">Capturando screenshot...</div>
                      <div className="text-xs text-muted-foreground">Modelo {model} analisando viewport</div>
                    </div>
                    <MousePointer2 className="absolute h-5 w-5 text-primary animate-bounce" style={{ top: "60%", left: "45%" }} />
                  </>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Monitor className="h-12 w-12 mx-auto mb-2 opacity-40" />
                    <div className="text-sm">Aguardando tarefa</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Ex: Acesse fatorx.app, faça login com demo@fatorx.app e baixe o relatório de abril" />
                <Button onClick={runTask} disabled={running || !task.trim()}>
                  {running ? <><Square className="h-4 w-4 mr-2" />Parar</> : <><Play className="h-4 w-4 mr-2" />Executar</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FastForward className="h-4 w-4" />Trajetória de ações</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {actions.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">Nenhuma ação executada ainda</div>}
                <div className="space-y-1.5">
                  {actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 text-xs">
                      <Badge variant="outline" className="font-mono w-20 justify-center">{a.type}</Badge>
                      <div className="flex-1 truncate">
                        {a.target && <span className="font-mono text-muted-foreground">{a.target}</span>}
                        {a.text && <span> → "{a.text}"</span>}
                        {a.type === "screenshot" && <span className="text-muted-foreground">Captura do viewport (1280×720)</span>}
                        {a.type === "wait" && <span className="text-muted-foreground">Aguardando 800ms (network idle)</span>}
                      </div>
                      <CheckCircle2 className="h-3.5 w-3.5 text-nexus-green" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Modelo Vision</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { id: "claude-sonnet-4", name: "Claude Sonnet 4", badge: "Recomendado" },
                { id: "gpt-4o", name: "GPT-4o Vision", badge: "Rápido" },
                { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", badge: "Multimodal" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full text-left p-2.5 rounded-md border transition-all ${model === m.id ? "border-primary bg-primary/8" : "border-border/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{m.name}</span>
                    <Badge variant="outline" className="text-[10px]">{m.badge}</Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Templates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {PRESETS.map((p) => (
                <button key={p.title} onClick={() => setTask(p.desc)} className="w-full text-left p-2.5 rounded-md hover:bg-muted/40 border border-border/30">
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-nexus-amber/30 bg-nexus-amber/5">
            <CardContent className="p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-nexus-amber shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-medium">Sandbox isolado obrigatório</div>
                <div className="text-muted-foreground mt-0.5">Computer Use só roda em browsers efêmeros (Cloudflare Browser Rendering / E2B)</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
