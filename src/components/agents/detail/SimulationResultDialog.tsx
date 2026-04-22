import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Zap, DollarSign, Cpu, TrendingUp, RefreshCw, Play, Pencil, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SimulationSummary } from '@/services/agentTestSimulationService';
import { saveRun } from '@/services/savedTestRunsStore';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SimulationSummary | null;
  running: boolean;
  /** Disparado quando o usuário aciona "Executar simulação". */
  onRun: (customInput: string, count: number) => void;
  agentName: string;
  /** Quando definido, substitui o título padrão (modo "ver run salvo"). */
  readOnlyTitle?: string;
  /** Esconde editor de prompt, seletor de contagem e botão Executar. */
  hideRunControls?: boolean;
  /** Necessário para salvar — id do agente atual. */
  agentId?: string;
}

const MAX_PROMPT_LEN = 1000;
const COUNT_PRESETS = [10, 25, 50] as const;
type CountValue = (typeof COUNT_PRESETS)[number];
const PLACEHOLDER =
  'Digite um prompt customizado para usar em todas as execuções. Deixe vazio para usar a amostra padrão (8 perguntas variadas de clientes).';

function formatCost(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function successColor(rate: number): string {
  if (rate >= 90) return 'text-nexus-emerald';
  if (rate >= 70) return 'text-nexus-amber';
  return 'text-destructive';
}

function successBg(rate: number): string {
  if (rate >= 90) return 'bg-nexus-emerald/10 border-nexus-emerald/30';
  if (rate >= 70) return 'bg-nexus-amber/10 border-nexus-amber/30';
  return 'bg-destructive/10 border-destructive/30';
}

export function SimulationResultDialog({
  open, onOpenChange, summary, running, onRun, agentName,
  readOnlyTitle, hideRunControls = false, agentId,
}: Props) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState<CountValue>(10);
  const [saveName, setSaveName] = useState('');
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // Reseta o prompt cada vez que o diálogo abre sem resultado prévio
  useEffect(() => {
    if (open && !summary && !running) {
      setPrompt('');
    }
    if (open) {
      setJustSavedId(null);
      setSaveName('');
    }
  }, [open, summary, running]);

  const trimmed = prompt.trim();
  const usingCustom = trimmed.length > 0;
  const overLimit = trimmed.length > MAX_PROMPT_LEN;
  const canSave = !!summary && !!agentId && !running;

  const handleSave = () => {
    if (!summary || !agentId) return;
    const defaultName = `Run ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${summary.successRate.toFixed(0)}% · ${summary.total} runs`;
    const saved = saveRun({
      agentId,
      name: saveName.trim() || defaultName,
      prompt: trimmed,
      summary,
    });
    setJustSavedId(saved.id);
    toast.success(`Test Run salvo: "${saved.name}"`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {readOnlyTitle ?? 'Simular execução do agente'}
            {!readOnlyTitle && summary && !running && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {summary.total} execuções · {agentName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {readOnlyTitle
              ? 'Visualizando resultado salvo. Use “Simular run” no header para nova execução.'
              : 'Simulação client-side com base em traces reais. Não consome créditos de LLM.'}
          </DialogDescription>
        </DialogHeader>

        {/* Editor de prompt — sempre visível para permitir editar e re-rodar */}
        <div className="space-y-1.5">
          <label htmlFor="sim-prompt" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Pencil className="h-3 w-3 text-primary" aria-hidden="true" />
            Prompt de entrada
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <Textarea
            id="sim-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PLACEHOLDER}
            disabled={running}
            rows={3}
            maxLength={MAX_PROMPT_LEN + 50}
            className="text-xs font-mono resize-none"
            aria-describedby="sim-prompt-help"
          />
          <div id="sim-prompt-help" className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {usingCustom
                ? `✓ Todas as ${count} execuções vão usar este prompt customizado`
                : 'Sem prompt: usa amostra padrão variada (8 perguntas)'}
            </span>
            <span className={overLimit ? 'text-destructive' : ''}>
              {trimmed.length}/{MAX_PROMPT_LEN}
            </span>
          </div>
        </div>

        {/* Seletor de contagem de execuções */}
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <RefreshCw className="h-3 w-3 text-primary" aria-hidden="true" />
            Número de execuções
          </span>
          <div
            role="radiogroup"
            aria-label="Número de execuções a simular"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 p-1 w-fit"
          >
            {COUNT_PRESETS.map((c) => {
              const selected = count === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCount(c)}
                  disabled={running}
                  className={`px-3 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-50'
                  }`}
                >
                  {c} runs
                </button>
              );
            })}
            <span className="text-[10px] text-muted-foreground/70 ml-1.5 pr-1">
              Mais runs = estatísticas mais estáveis
            </span>
          </div>
        </div>

        {running && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Executando {count} simulações…</p>
          </div>
        )}

        {!running && summary && (
          <div className="space-y-4">
            {/* Status header */}
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${successBg(summary.successRate)}`}>
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-nexus-emerald font-semibold">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {summary.passed} OK
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1.5 text-destructive font-semibold">
                  <XCircle className="h-4 w-4" aria-hidden="true" /> {summary.failed} erro{summary.failed !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Taxa de sucesso</p>
                <p className={`text-2xl font-heading font-extrabold tabular-nums ${successColor(summary.successRate)}`}>
                  {summary.successRate.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStat icon={Zap} label="Latência média" value={`${summary.avgLatency}ms`} />
              <MiniStat icon={TrendingUp} label="p95 latência" value={`${summary.p95Latency}ms`} />
              <MiniStat icon={DollarSign} label="Custo total" value={formatCost(summary.totalCost)} />
              <MiniStat icon={Cpu} label="Tokens totais" value={summary.totalTokens.toLocaleString('pt-BR')} />
            </div>

            {/* Runs table */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 sticky top-0">
                    <tr className="text-left text-muted-foreground border-b border-border/50">
                      <th scope="col" className="py-2 px-2 font-medium w-8">#</th>
                      <th scope="col" className="py-2 px-2 font-medium w-16">Status</th>
                      <th scope="col" className="py-2 px-2 font-medium">Input</th>
                      <th scope="col" className="py-2 px-2 font-medium text-right">Latência</th>
                      <th scope="col" className="py-2 px-2 font-medium text-right">Tokens</th>
                      <th scope="col" className="py-2 px-2 font-medium text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.runs.map((r) => (
                      <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/20">
                        <td className="py-1.5 px-2 font-mono text-muted-foreground">{r.id}</td>
                        <td className="py-1.5 px-2">
                          {r.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-nexus-emerald">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <XCircle className="h-3 w-3" aria-hidden="true" /> Err
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-foreground truncate max-w-[280px]" title={r.input}>{r.input}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{r.latency_ms}ms</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{r.tokens_used.toLocaleString('pt-BR')}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{formatCost(r.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant={summary ? 'outline' : 'default'}
            size="sm"
            onClick={() => onRun(trimmed, count)}
            disabled={running || overLimit}
          >
            {summary ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Repetir simulação
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Executar simulação
              </>
            )}
          </Button>
          <Button variant={summary ? 'default' : 'outline'} size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </div>
      <p className="text-sm font-mono font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
