import { useState } from "react";
import { Bug, Pause, Play, SkipForward, Variable, MessageSquare, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";

type Step = { idx: number; type: "llm" | "tool" | "memory" | "decision"; name: string; status: "done" | "current" | "pending" | "breakpoint"; duration?: number };

const STEPS: Step[] = [
  { idx: 1, type: "memory", name: "Carregar contexto do usuário", status: "done", duration: 42 },
  { idx: 2, type: "llm", name: "Classificar intenção", status: "done", duration: 380 },
  { idx: 3, type: "decision", name: "Roteamento → tool", status: "done", duration: 5 },
  { idx: 4, type: "tool", name: "search_knowledge_base()", status: "breakpoint", duration: 220 },
  { idx: 5, type: "llm", name: "Sintetizar resposta", status: "current", duration: 0 },
  { idx: 6, type: "tool", name: "log_interaction()", status: "pending" },
  { idx: 7, type: "memory", name: "Atualizar memória", status: "pending" },
];

export default function AgentDebuggerPage() {
  const [paused, setPaused] = useState(true);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set([4]));

  const toggleBreakpoint = (idx: number) => {
    setBreakpoints((bp) => {
      const next = new Set(bp);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Agent Debugger"
        description="Debug visual com breakpoints, step-into, inspeção de variáveis e watch expressions. Estilo Chrome DevTools."
      />

      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <Button size="sm" variant={paused ? "default" : "outline"} onClick={() => setPaused(!paused)}>
            {paused ? <><Play className="h-3.5 w-3.5 mr-1" />Continuar</> : <><Pause className="h-3.5 w-3.5 mr-1" />Pausar</>}
          </Button>
          <Button size="sm" variant="outline"><SkipForward className="h-3.5 w-3.5 mr-1" />Step over</Button>
          <Button size="sm" variant="outline">Step into</Button>
          <Button size="sm" variant="outline">Step out</Button>
          <div className="flex-1" />
          <Badge variant="outline" className="text-[10px]">Sessão: sess_a4f2e1 · Pausado em #4</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Bug className="h-4 w-4" />Trajetória de execução</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[480px]">
              <div className="space-y-1">
                {STEPS.map((s) => {
                  const isBp = breakpoints.has(s.idx);
                  return (
                    <div key={s.idx}
                      className={`flex items-center gap-3 p-2.5 rounded-md text-xs border ${
                        s.status === "current" ? "border-nexus-amber/50 bg-nexus-amber/8 ring-1 ring-nexus-amber/30" :
                        s.status === "breakpoint" ? "border-nexus-red/40 bg-nexus-red/5" :
                        s.status === "done" ? "border-border/30 bg-muted/20" :
                        "border-border/20 opacity-50"
                      }`}>
                      <button onClick={() => toggleBreakpoint(s.idx)}
                        className={`h-3 w-3 rounded-full border-2 transition-all ${isBp ? "bg-nexus-red border-nexus-red" : "border-border hover:border-nexus-red/50"}`}
                        title="Toggle breakpoint" />
                      <span className="font-mono text-muted-foreground w-6">{s.idx}</span>
                      <Badge variant="outline" className="text-[10px] capitalize w-16 justify-center">{s.type}</Badge>
                      <span className="flex-1 font-mono">{s.name}</span>
                      {s.duration !== undefined && s.duration > 0 && <span className="text-muted-foreground font-mono">{s.duration}ms</span>}
                      {s.status === "current" && <Badge className="text-[10px] bg-nexus-amber/20 text-nexus-amber">⏸ aqui</Badge>}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Inspetor</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="vars">
              <TabsList className="w-full">
                <TabsTrigger value="vars" className="flex-1"><Variable className="h-3 w-3 mr-1" />Vars</TabsTrigger>
                <TabsTrigger value="messages" className="flex-1"><MessageSquare className="h-3 w-3 mr-1" />Msgs</TabsTrigger>
                <TabsTrigger value="tools" className="flex-1"><Wrench className="h-3 w-3 mr-1" />Tools</TabsTrigger>
              </TabsList>
              <TabsContent value="vars" className="text-xs space-y-1.5 font-mono max-h-[420px] overflow-auto">
                {[
                  { k: "user_id", v: "usr_8f2a1e", t: "string" },
                  { k: "intent", v: "'support_query'", t: "string" },
                  { k: "context_size", v: "2847", t: "number" },
                  { k: "kb_results", v: "Array(5)", t: "array" },
                  { k: "confidence", v: "0.92", t: "number" },
                  { k: "tools_available", v: "Array(7)", t: "array" },
                  { k: "memory_hits", v: "3", t: "number" },
                ].map((v) => (
                  <div key={v.k} className="p-2 bg-muted/30 rounded flex items-center gap-2">
                    <span className="text-muted-foreground">{v.k}:</span>
                    <span className="text-primary">{v.v}</span>
                    <Badge variant="outline" className="ml-auto text-[9px]">{v.t}</Badge>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="messages" className="text-xs space-y-2 max-h-[420px] overflow-auto">
                <div className="p-2.5 bg-muted/30 rounded"><Badge className="text-[10px] mb-1">user</Badge><div>Como cancelo minha assinatura?</div></div>
                <div className="p-2.5 bg-primary/8 rounded"><Badge className="text-[10px] mb-1">assistant</Badge><div className="text-muted-foreground">[gerando resposta...]</div></div>
              </TabsContent>
              <TabsContent value="tools" className="text-xs space-y-1.5 max-h-[420px] overflow-auto">
                {["search_knowledge_base", "create_ticket", "send_email", "log_interaction", "fetch_user_plan"].map((t) => (
                  <div key={t} className="p-2 bg-muted/30 rounded font-mono">{t}()</div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
