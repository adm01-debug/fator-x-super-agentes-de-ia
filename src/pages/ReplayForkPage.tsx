import { useEffect, useState, useMemo, useCallback } from "react";
import {
  GitBranch, Play, Pause, SkipBack, SkipForward, Layers, Hash,
  ShieldCheck, ShieldAlert, Download, Sparkles, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { StateDiff } from "@/components/replay/StateDiff";
import { ForkHistoryPanel } from "@/components/replay/ForkHistoryPanel";
import { replayForkService, type ReplayFork } from "@/services/replayForkService";

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

  const [forks, setForks] = useState<ReplayFork[]>([]);
  const [forksLoading, setForksLoading] = useState(true);
  const [selectedFork, setSelectedFork] = useState<ReplayFork | null>(null);

  const [forkDialog, setForkDialog] = useState(false);
  const [forkName, setForkName] = useState("");
  const [overrideInput, setOverrideInput] = useState("");
  const [seed, setSeed] = useState("");

  const loadSnapshots = useCallback(async () => {
    try {
      const { data, error } = await supabaseExternal
        .from("forensic_snapshots")
        .select("id,agent_id,execution_id,step_index,decision_type,decision_rationale,state_before,state_after,input_hash,output_hash,chain_hash,previous_hash,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
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
      setLoading(false);
    }
  }, []);

  const loadForks = useCallback(async () => {
    setForksLoading(true);
    const list = await replayForkService.list();
    setForks(list);
    setForksLoading(false);
  }, []);

  useEffect(() => { loadSnapshots(); loadForks(); }, [loadSnapshots, loadForks]);

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

  const chainCheck = useMemo(() => replayForkService.verifyChain(execSnapshots), [execSnapshots]);

  const openForkDialog = () => {
    if (!current) return;
    setForkName(`Fork @ step ${current.step_index} — ${new Date().toLocaleTimeString("pt-BR")}`);
    setOverrideInput("");
    setSeed(crypto.randomUUID().slice(0, 16));
    setForkDialog(true);
  };

  const handleCreateFork = async () => {
    if (!current || !selectedExec) return;
    let parsedOverride: unknown = null;
    if (overrideInput.trim()) {
      try { parsedOverride = JSON.parse(overrideInput); }
      catch { toast.error("Override input não é um JSON válido"); return; }
    }
    const baseSnapshot = execSnapshots.slice(0, step + 1).map(s => ({
      step_index: s.step_index,
      decision_type: s.decision_type,
      decision_rationale: s.decision_rationale,
      state_before: s.state_before,
      state_after: s.state_after,
      input_hash: s.input_hash,
      output_hash: s.output_hash,
      chain_hash: s.chain_hash,
      previous_hash: s.previous_hash,
    }));
    const fork = await replayForkService.create({
      name: forkName || `Fork @ step ${current.step_index}`,
      parent_execution_id: selectedExec,
      parent_agent_id: current.agent_id,
      fork_step_index: current.step_index,
      parent_chain_hash: current.chain_hash,
      override_input: parsedOverride,
      state_snapshot: baseSnapshot,
      deterministic_seed: seed,
    });
    if (!fork) { toast.error("Falha ao criar fork"); return; }
    setForkDialog(false);
    toast.success("Fork criado", { description: "Executando em background..." });
    await loadForks();
    const result = await replayForkService.execute(fork.id);
    if (result.success) toast.success("Fork executado com sucesso");
    else toast.error("Fork falhou", { description: result.error });
    await loadForks();
  };

  const handleExecuteFork = async (id: string) => {
    toast.info("Executando fork...");
    const r = await replayForkService.execute(id);
    if (r.success) toast.success("Fork executado");
    else toast.error("Falhou", { description: r.error });
    await loadForks();
  };

  const handleDeleteFork = async (id: string) => {
    const ok = await replayForkService.remove(id);
    if (ok) { toast.success("Fork removido"); await loadForks(); if (selectedFork?.id === id) setSelectedFork(null); }
  };

  const handleExport = () => {
    if (!selectedExec) return;
    const payload = { execution_id: selectedExec, snapshots: execSnapshots, forks: forks.filter(f => f.parent_execution_id === selectedExec) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `replay-${selectedExec.slice(0, 8)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Replay exportado");
  };

  const forksForExec = forks.filter(f => f.parent_execution_id === selectedExec);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1600px] mx-auto animate-page-enter">
      <PageHeader
        title="Replay & Fork"
        description="Time-travel debugging visual — replay determinístico de execuções com fork a partir de qualquer step (estilo LangGraph Studio)."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { loadSnapshots(); loadForks(); }}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!selectedExec}>
              <Download className="h-3 w-3 mr-1" /> Exportar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
        {/* LEFT: executions list */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" />Execuções</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[640px]">
              {loading && <div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
              {!loading && executions.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma execução com snapshots forenses ainda.</div>}
              <div className="divide-y divide-border/40">
                {executions.map((e) => {
                  const forkCount = forks.filter(f => f.parent_execution_id === e.id).length;
                  return (
                    <button
                      key={e.id}
                      onClick={() => { setSelectedExec(e.id); setStep(0); setPlaying(false); }}
                      className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${selectedExec === e.id ? "bg-primary/8" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-muted-foreground truncate">{e.id.slice(0, 14)}...</span>
                        {forkCount > 0 && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1">
                            <GitBranch className="h-2 w-2" />{forkCount}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span>{e.count} steps</span>
                        <span>·</span>
                        <span>{new Date(e.start).toLocaleString("pt-BR")}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* CENTER: time-travel + state */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Time-travel</CardTitle>
              {selectedExec && (
                <Badge variant={chainCheck.valid ? "outline" : "destructive"} className="text-[10px] gap-1">
                  {chainCheck.valid
                    ? <><ShieldCheck className="h-3 w-3" /> Cadeia íntegra</>
                    : <><ShieldAlert className="h-3 w-3" /> Quebra @ step {chainCheck.brokenAt}</>}
                </Badge>
              )}
            </div>
            {current && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7" onClick={() => setStep(Math.max(0, step - 1))}><SkipBack className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setPlaying(!playing)}>{playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setStep(Math.min(execSnapshots.length - 1, step + 1))}><SkipForward className="h-3 w-3" /></Button>
                <Button size="sm" className="h-7 ml-2" onClick={openForkDialog}><GitBranch className="h-3 w-3 mr-1" />Fork</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedExec && <div className="h-[580px] flex items-center justify-center text-muted-foreground text-sm">Selecione uma execução à esquerda</div>}
            {selectedExec && execSnapshots.length === 0 && <div className="h-[580px] flex items-center justify-center text-muted-foreground text-sm">Sem snapshots</div>}
            {current && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Step {current.step_index + 1} / {execSnapshots.length}</Badge>
                      <Badge variant="outline" className="text-xs">{current.decision_type}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(current.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <Slider value={[step]} onValueChange={(v) => setStep(v[0])} min={0} max={Math.max(0, execSnapshots.length - 1)} step={1} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2 bg-muted/30 rounded"><div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Input</div><div className="font-mono mt-1 truncate">{current.input_hash.slice(0, 24)}...</div></div>
                  <div className="p-2 bg-muted/30 rounded"><div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Output</div><div className="font-mono mt-1 truncate">{current.output_hash.slice(0, 24)}...</div></div>
                  <div className="p-2 bg-muted/30 rounded col-span-2"><div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Chain hash</div><div className="font-mono mt-1 truncate">{current.chain_hash}</div></div>
                </div>

                <Tabs defaultValue="diff">
                  <TabsList>
                    <TabsTrigger value="diff">Diff</TabsTrigger>
                    <TabsTrigger value="rationale">Rationale</TabsTrigger>
                    <TabsTrigger value="before">Before</TabsTrigger>
                    <TabsTrigger value="after">After</TabsTrigger>
                  </TabsList>
                  <TabsContent value="diff">
                    <StateDiff before={current.state_before} after={current.state_after} />
                  </TabsContent>
                  <TabsContent value="rationale">
                    <Card><CardContent className="p-4 text-sm">{current.decision_rationale || <span className="text-muted-foreground">Sem rationale registrado.</span>}</CardContent></Card>
                  </TabsContent>
                  <TabsContent value="before">
                    <pre className="text-[10px] bg-muted/30 p-3 rounded overflow-auto max-h-[320px] font-mono">{JSON.stringify(current.state_before, null, 2)}</pre>
                  </TabsContent>
                  <TabsContent value="after">
                    <pre className="text-[10px] bg-muted/30 p-3 rounded overflow-auto max-h-[320px] font-mono">{JSON.stringify(current.state_after, null, 2)}</pre>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: forks panel */}
        <div className="space-y-4">
          <ForkHistoryPanel
            forks={selectedExec ? forksForExec : forks}
            loading={forksLoading}
            onExecute={handleExecuteFork}
            onDelete={handleDeleteFork}
            onSelect={setSelectedFork}
            selectedId={selectedFork?.id ?? null}
          />
          {selectedFork && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Resultado do fork
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/30 rounded"><div className="text-[10px] text-muted-foreground">Status</div><div className="font-medium">{selectedFork.status}</div></div>
                  <div className="p-2 bg-muted/30 rounded"><div className="text-[10px] text-muted-foreground">Custo</div><div className="font-medium">${selectedFork.cost_usd.toFixed(4)}</div></div>
                  <div className="p-2 bg-muted/30 rounded"><div className="text-[10px] text-muted-foreground">Steps</div><div className="font-medium">{selectedFork.total_steps}</div></div>
                  <div className="p-2 bg-muted/30 rounded"><div className="text-[10px] text-muted-foreground">Latência</div><div className="font-medium">{selectedFork.duration_ms ?? "—"}ms</div></div>
                </div>
                {selectedFork.deterministic_seed && (
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="text-[10px] text-muted-foreground">Seed determinístico</div>
                    <div className="font-mono text-[10px] truncate">{selectedFork.deterministic_seed}</div>
                  </div>
                )}
                {selectedFork.new_execution_id && (
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="text-[10px] text-muted-foreground">Nova execução</div>
                    <div className="font-mono text-[10px] truncate">{selectedFork.new_execution_id}</div>
                  </div>
                )}
                {selectedFork.error_message && (
                  <div className="p-2 bg-destructive/10 text-destructive rounded text-[11px]">
                    {selectedFork.error_message}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={forkDialog} onOpenChange={setForkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar fork de execução</DialogTitle>
            <DialogDescription>
              Cria uma nova execução determinística a partir do step {current?.step_index ?? 0}.
              Você pode opcionalmente sobrescrever o input e fixar um seed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do fork</Label>
              <Input value={forkName} onChange={e => setForkName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Override input (JSON, opcional)</Label>
              <Textarea
                value={overrideInput}
                onChange={e => setOverrideInput(e.target.value)}
                className="mt-1 font-mono text-xs"
                rows={4}
                placeholder='{"prompt": "novo input..."}'
              />
            </div>
            <div>
              <Label className="text-xs">Seed determinístico</Label>
              <Input value={seed} onChange={e => setSeed(e.target.value)} className="mt-1 font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Mesmo seed + mesmo input = resultado idêntico (replay reproduzível).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForkDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateFork}><GitBranch className="h-3 w-3 mr-1" />Criar e executar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
