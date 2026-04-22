import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Play,
  Copy,
  RotateCw,
  Zap,
  Wallet,
  Hash,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { useCostEstimate } from '@/hooks/useCostEstimate';
import { getModelPrice, USD_TO_BRL } from '@/lib/llmPricing';
import { quickPromptSchema, type QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { QUICK_AGENT_MOCK_INPUTS, type QuickAgentType } from '@/data/quickAgentTemplates';
import { cn } from '@/lib/utils';

interface Props {
  form: QuickAgentForm;
}

interface TestResult {
  response: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model_used: string;
  cost_usd: number;
  cost_brl: number;
}

function formatBrl(brl: number): string {
  if (brl < 0.01) return 'R$ <0,01';
  return `R$ ${brl.toFixed(brl < 1 ? 4 : 2).replace('.', ',')}`;
}
function formatUsd(usd: number): string {
  if (usd < 0.0001) return '$<0,0001';
  return `$${usd.toFixed(usd < 0.01 ? 5 : 4)}`;
}
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function QuickAgentTestPanel({ form }: Props) {
  const type = form.type as QuickAgentType;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mocks = QUICK_AGENT_MOCK_INPUTS[type] ?? [{ label: 'Mensagem', input: 'Olá!' }];

  const [userInput, setUserInput] = useState<string>(mocks[0]?.input ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset textarea when type changes (different mocks).
  useEffect(() => {
    setUserInput(mocks[0]?.input ?? '');
    setResult(null);
    setError(null);
  }, [type, mocks]);

  const promptValidation = useMemo(
    () => quickPromptSchema.safeParse({ prompt: form.prompt }),
    [form.prompt],
  );
  const promptValid = promptValidation.success;

  const estimate = useCostEstimate({
    model: form.model,
    systemPrompt: form.prompt,
    userInput,
    maxTokens: 800,
  });

  const canRun = promptValid && userInput.trim().length > 0 && !loading;

  const runTest = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: invokeError } = await supabaseExternal.functions.invoke(
        'quick-agent-test',
        {
          body: {
            system_prompt: form.prompt,
            user_message: userInput.trim(),
            model: form.model,
          },
        },
      );
      if (invokeError) throw new Error(invokeError.message);
      if (!data || typeof data !== 'object') throw new Error('Resposta inválida do gateway');
      const payload = data as Record<string, unknown>;
      if (payload.error) throw new Error(String(payload.error));

      const inputTokens = Number(payload.input_tokens ?? 0);
      const outputTokens = Number(payload.output_tokens ?? 0);
      const pricing = getModelPrice(form.model);
      const costUsd =
        (inputTokens / 1000) * pricing.input_per_1k + (outputTokens / 1000) * pricing.output_per_1k;

      const r: TestResult = {
        response: String(payload.response ?? ''),
        latency_ms: Number(payload.latency_ms ?? 0),
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: Number(payload.total_tokens ?? inputTokens + outputTokens),
        model_used: String(payload.model_used ?? form.model),
        cost_usd: costUsd,
        cost_brl: costUsd * USD_TO_BRL,
      };
      setResult(r);
      toast.success('Teste executado', {
        description: `${formatLatency(r.latency_ms)} · ${formatBrl(r.cost_brl)}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado';
      setError(msg);
      toast.error('Falha ao executar teste', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.response);
      toast.success('Resposta copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="nexus-card space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-heading font-semibold text-foreground flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5 text-primary" />
            Teste rápido do agente
          </p>
          <p className="text-[11px] text-muted-foreground">
            Execute uma chamada real ao modelo antes de criar — veja resposta, custo e latência.
          </p>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/80 text-right">
          est. {estimate.totalTokens.toLocaleString('pt-BR')} tk · {formatBrl(estimate.costBrl)}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="qa-test-input" className="text-xs text-muted-foreground">
            Mensagem de teste
          </Label>
          <Select
            onValueChange={(val) => {
              const m = mocks.find((x) => x.label === val);
              if (m) setUserInput(m.input);
            }}
          >
            <SelectTrigger className="h-7 w-auto min-w-[160px] text-[11px] bg-secondary/40">
              <SelectValue placeholder="Mock por tipo" />
            </SelectTrigger>
            <SelectContent>
              {mocks.map((m) => (
                <SelectItem key={m.label} value={m.label} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          id="qa-test-input"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Digite uma mensagem para testar o agente…"
          className="bg-secondary/50 border-border/50 text-sm resize-none"
        />
      </div>

      {!promptValid && (
        <div className="flex items-start gap-2 text-[11px] text-nexus-amber bg-nexus-amber/5 border border-nexus-amber/30 rounded-md p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Complete o system prompt (incluindo as 4 seções obrigatórias) antes de testar.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-muted-foreground/80 font-mono">
          modelo: {form.model} · max_tokens: 800
        </p>
        <Button
          type="button"
          size="sm"
          onClick={runTest}
          disabled={!canRun}
          aria-busy={loading}
          className="gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executando…
            </>
          ) : result ? (
            <>
              <RotateCw className="h-3.5 w-3.5" /> Executar novamente
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Executar teste
            </>
          )}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-md p-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div role="status" aria-live="polite" className="space-y-2.5 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Latência"
              value={formatLatency(result.latency_ms)}
              tone="primary"
            />
            <MetricCard
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Custo real"
              value={formatBrl(result.cost_brl)}
              hint={formatUsd(result.cost_usd)}
              tone="emerald"
            />
            <MetricCard
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Tokens"
              value={`${result.input_tokens}→${result.output_tokens}`}
              hint={`${result.total_tokens} total`}
              tone="muted"
            />
          </div>

          <div className="rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider text-nexus-emerald font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> Resposta do agente
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={copyResponse}
                className="h-6 gap-1 text-[10px]"
              >
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-words text-xs text-foreground font-sans leading-relaxed max-h-64 overflow-y-auto">
              {result.response || (
                <span className="text-muted-foreground italic">(resposta vazia)</span>
              )}
            </pre>
            <p className="text-[10px] font-mono text-muted-foreground/70 pt-1 border-t border-nexus-emerald/15">
              servido por: {result.model_used}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: 'primary' | 'emerald' | 'muted';
}

function MetricCard({ icon, label, value, hint, tone }: MetricCardProps) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/30 bg-primary/5 text-primary'
      : tone === 'emerald'
        ? 'border-nexus-emerald/30 bg-nexus-emerald/5 text-nexus-emerald'
        : 'border-border bg-secondary/40 text-foreground';
  return (
    <div className={cn('rounded-lg border p-2.5', toneClass)}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-sm font-mono font-semibold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
