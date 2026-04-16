import { useEffect, useState, useMemo } from "react";
import { GitBranch, Play, Pause, SkipBack, SkipForward, Copy, Layers, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

type Snapshot = {
  id: string;
  agent_id: string;
  execution_id: string;
  step_index: number;
  decision_type: string;
  decision_rationale: string;
  state_before: unknown;
  state_after: unknown;
  input_hash: string;
  output_hash: string;
  chain_hash: string;
  previous_hash: string;
  created_at: string;
};

export default function ReplayForkPage() {
  const [executions, setExecutions] = useState<{ id: string; agent_id: string; count: number; start: string }[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedExec, setSelectedExec] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabaseExternal
          .from("forensic_snapshots")
          .select("id,agent_id,execution_id,step_index,decision_type,decision_rationale,state_before,state_after,input_hash,output_hash,chain_hash,previous_hash,created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        if (!active) return;
        const all = (data as Snapshot[]) || [];
        setSnapshots(all);
        const byExec = new Map<string, { id: string; agent_id: string; count: number; start: string }>();
        for (const s of all) {
          const key = s.execution_id;
          if (!byExec.has(key)) byExec.set(key, { id: key, agent_id: s.agent_id, count: 0, start: s.created_at });
          byExec.get(key)!.count++;
        }
        setExecutions(Array.from(byExec.values()));
      } catch (e) {
        logger.error("Failed to load snapshots", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const execSnapshots = useMemo(
    () => snapshots.filter(s => s.execution_id === selectedExec).sort((a, b) => a.step_index - b.step_index),
    [snapshots, selectedExec]
  );

  useEffect(() => {
    if (!playing || execSnapshots.length === 0) return;
    const t = setInterval(() => {
      setStep((s) => {
        if (s >= execSnapshots.length - 1) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 800);
    return () => clearInterval(t);
  }, [playing, execSnapshots.length]);

  const current = execSnapshots[step];

  const handleFork = () => {
    if (!current) return;
    toast.success(`Fork criado a partir do step ${current.step_index}`, {
      description: `Hash: ${current.chain_hash.slice(0, 12)}... — nova execução iniciada`,
    });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Replay & Fork"
        description="Time-travel debugging visual — replay determinístico de execuções com fork a partir de qualquer step."
        icon={GitBranch}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" />Execuções</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading && <div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
              {!loading && executions.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma execução com snapshots forenses ainda.</div>}
              <div className="divide-y divide-border/40">
                {executions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { setSelectedExec(e.id); setStep(0); setPlaying(false); }}
                    className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${selectedExec === e.id ? "bg-primary/8" : ""}`}
                  >
                    <div className="text-xs font-mono text-muted-foreground truncate">{e.id.slice(0, 16)}...</div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{e.count} steps</span>
                      <span>·</span>
                      <span>{new Date(e.start).toLocaleString("pt-BR")}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">Time-travel</CardTitle>
            {current && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7" onClick={() => setStep(Math.max(0, step - 1))}><SkipBack className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setPlaying(!playing)}>{playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setStep(Math.min(execSnapshots.length - 1, step + 1))}><SkipForward className="h-3 w-3" /></Button>
                <Button size="sm" className="h-7 ml-2" onClick={handleFork}><GitBranch className="h-3 w-3 mr-1" />Fork</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedExec && <div className="h-[540px] flex items-center justify-center text-muted-foreground text-sm">Selecione uma execução</div>}
            {selectedExec && execSnapshots.length === 0 && <div className="h-[540px] flex items-center justify-center text-muted-foreground text-sm">Sem snapshots</div>}
            {current && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">Step {current.step_index + 1} / {execSnapshots.length}</Badge>
                    <Badge variant="outline" className="text-xs">{current.decision_type}</Badge>
                  </div>
                  <Slider value={[step]} onValueChange={(v) => setStep(v[0])} min={0} max={execSnapshots.length - 1} step={1} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2 bg-muted/30 rounded"><div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Input</div><div className="font-mono mt-1 truncate">{current.input_hash.slice(0, 20)}...</div></div>
                  <div className="p-2 bg-muted/30 rounded"><div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Output</div><div className="font-mono mt-1 truncate">{current.output_hash.slice(0, 20)}...</div></div>
                  <div className="p-2 bg-muted/30 rounded col-span-2"><div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Chain hash</div><div className="font-mono mt-1 truncate">{current.chain_hash}</div></div>
                </div>

                <Tabs defaultValue="rationale">
                  <TabsList>
                    <TabsTrigger value="rationale">Rationale</TabsTrigger>
                    <TabsTrigger value="before">State Before</TabsTrigger>
                    <TabsTrigger value="after">State After</TabsTrigger>
                  </TabsList>
                  <TabsContent value="rationale">
                    <Card><CardContent className="p-4 text-sm">{current.decision_rationale || <span className="text-muted-foreground">Sem rationale registrado.</span>}</CardContent></Card>
                  </TabsContent>
                  <TabsContent value="before">
                    <pre className="text-[10px] bg-muted/30 p-3 rounded overflow-auto max-h-[300px]">{JSON.stringify(current.state_before, null, 2)}</pre>
                  </TabsContent>
                  <TabsContent value="after">
                    <pre className="text-[10px] bg-muted/30 p-3 rounded overflow-auto max-h-[300px]">{JSON.stringify(current.state_after, null, 2)}</pre>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
