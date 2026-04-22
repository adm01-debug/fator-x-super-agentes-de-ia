import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Send,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Braces,
  Terminal,
  RotateCw,
  Sparkles,
  User as UserIcon,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { compilePrompt } from '@/lib/promptCompiler';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { useCostEstimate } from '@/hooks/useCostEstimate';
import { getModelPrice, USD_TO_BRL } from '@/lib/llmPricing';
import { quickPromptSchema, type QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { QUICK_AGENT_MOCK_INPUTS, type QuickAgentType } from '@/data/quickAgentTemplates';
import { cn } from '@/lib/utils';

interface Props {
  form: QuickAgentForm;
  activeVariantLabel?: string | null;
  lastChangeKind?: 'variant' | 'manual' | null;
}

interface SimResult {
  response: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model_used: string;
  cost_usd: number;
  cost_brl: number;
}

const MAX_TOKENS = 800;

function formatBrl(brl: number): string {
  if (brl < 0.01) return 'R$ <0,01';
  return `R$ ${brl.toFixed(brl < 1 ? 4 : 2).replace('.', ',')}`;
}
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Cheap, stable hash for invalidating the "validated" badge when the prompt changes. */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function RealExamplePreview({ form, activeVariantLabel = null, lastChangeKind = null }: Props) {
  const type = form.type as QuickAgentType;
  const mocks = QUICK_AGENT_MOCK_INPUTS[type] ?? [{ label: 'Mensagem', input: 'Olá!' }];

  const [selectedMockLabel, setSelectedMockLabel] = useState<string>(mocks[0]?.label ?? 'custom');
  const [userMessage, setUserMessage] = useState<string>(mocks[0]?.input ?? '');
  const [tab, setTab] = useState<'conversation' | 'json' | 'curl'>('conversation');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [validatedHash, setValidatedHash] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Reset when type changes
  useEffect(() => {
    setSelectedMockLabel(mocks[0]?.label ?? 'custom');
    setUserMessage(mocks[0]?.input ?? '');
    setResult(null);
    setError(null);
    setValidatedHash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const compiled = useMemo(() => compilePrompt(form), [form]);
  const promptHash = useMemo(() => hashString(compiled.text), [compiled.text]);

  // Invalidate validation badge if prompt changed since last successful run
  useEffect(() => {
    if (validatedHash && validatedHash !== promptHash) {
      setValidatedHash(null);
    }
  }, [promptHash, validatedHash]);

  // When variant changes, surface a clear "re-run" hint state by clearing prior result
  useEffect(() => {
    if (lastChangeKind === 'variant' && result) {
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChangeKind]);

  const promptValidation = useMemo(
    () => quickPromptSchema.safeParse({ prompt: form.prompt }),
    [form.prompt],
  );
  const promptValid = promptValidation.success;

  const estimate = useCostEstimate({
    model: form.model,
    systemPrompt: compiled.text,
    userInput: userMessage,
    maxTokens: MAX_TOKENS,
  });

  const payload = useMemo(
    () => ({
      system_prompt: compiled.text,
      user_message: userMessage.trim(),
      model: form.model,
    }),
    [compiled.text, userMessage, form.model],
  );

  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const curlCommand = useMemo(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://<project>.supabase.co'}/functions/v1/quick-agent-test`;
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '<ANON_KEY>';
    return [
      `curl -X POST '${url}' \\`,
      `  -H 'Authorization: Bearer ${anon}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`,
    ].join('\n');
  }, [payload]);

  const canRun = promptValid && userMessage.trim().length > 0 && !loading;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success('Copiado para a área de transferência');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const runSimulation = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: invokeError } = await supabaseExternal.functions.invoke(
        'quick-agent-test',
        {
          body: {
            system_prompt: compiled.text,
            user_message: userMessage.trim(),
            model: form.model,
          },
        },
      );
      if (invokeError) throw new Error(invokeError.message);
      if (!data || typeof data !== 'object') throw new Error('Resposta inválida do gateway');
      const p = data as Record<string, unknown>;
      if (p.error) throw new Error(String(p.error));

      const inputTokens = Number(p.input_tokens ?? 0);
      const outputTokens = Number(p.output_tokens ?? 0);
      const pricing = getModelPrice(form.model);
      const costUsd =
        (inputTokens / 1000) * pricing.input_per_1k + (outputTokens / 1000) * pricing.output_per_1k;

      const r: SimResult = {
        response: String(p.response ?? ''),
        latency_ms: Number(p.latency_ms ?? 0),
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: Number(p.total_tokens ?? inputTokens + outputTokens),
        model_used: String(p.model_used ?? form.model),
        cost_usd: costUsd,
        cost_brl: costUsd * USD_TO_BRL,
      };
      setResult(r);
      setValidatedHash(promptHash);
      toast.success('Exemplo validado', {
        description: `${formatLatency(r.latency_ms)} · ${formatBrl(r.cost_brl)}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado';
      setError(msg);
      toast.error('Falha na simulação', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const isValidated = validatedHash === promptHash && !!result;
  const promptChangedAfterRun = !!result && validatedHash !== promptHash;

  return (
    <div
      className={cn(
        'nexus-card border-primary/30 space-y-4 transition-shadow',
        isValidated && 'ring-1 ring-nexus-emerald/40',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Send className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-heading font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
              Exemplo real de envio
              {activeVariantLabel && (
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                  {activeVariantLabel}
                </Badge>
              )}
              {isValidated && (
                <Badge className="text-[10px] gap-1 bg-nexus-emerald/15 text-nexus-emerald border border-nexus-emerald/40 hover:bg-nexus-emerald/20">
                  <CheckCircle2 className="h-3 w-3" /> Pronto para avançar
                </Badge>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Veja exatamente como o agente vai receber sua chamada e simule o envio antes de salvar.
            </p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/80 text-right shrink-0">
          est. {estimate.totalTokens.toLocaleString('pt-BR')} tk · {formatBrl(estimate.costBrl)}
        </div>
      </div>

      {/* Scenario chips */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cenário de teste</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {mocks.map((m) => {
            const active = selectedMockLabel === m.label;
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => {
                  setSelectedMockLabel(m.label);
                  setUserMessage(m.input);
                }}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                  active
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                {m.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedMockLabel('custom')}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
              selectedMockLabel === 'custom'
                ? 'bg-nexus-amber/15 border-nexus-amber/40 text-nexus-amber'
                : 'bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            ✏️ Customizado
          </button>
        </div>
      </div>

      {/* User message editor */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mensagem do usuário</p>
        <Textarea
          value={userMessage}
          onChange={(e) => {
            setUserMessage(e.target.value);
            setSelectedMockLabel('custom');
          }}
          rows={2}
          maxLength={4000}
          placeholder="Como o usuário vai abordar o agente…"
          className="bg-secondary/50 border-border/50 text-sm resize-none"
        />
      </div>

      {/* Tabs: visualization of payload */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Como o agente vai receber
        </p>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-8 bg-secondary/40">
            <TabsTrigger value="conversation" className="text-[11px] gap-1.5 h-6">
              <MessageSquare className="h-3 w-3" /> Conversa
            </TabsTrigger>
            <TabsTrigger value="json" className="text-[11px] gap-1.5 h-6">
              <Braces className="h-3 w-3" /> Payload JSON
            </TabsTrigger>
            <TabsTrigger value="curl" className="text-[11px] gap-1.5 h-6">
              <Terminal className="h-3 w-3" /> cURL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="mt-3">
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2.5 max-h-[360px] overflow-auto">
              {/* System bubble */}
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-primary/80 mb-1">
                    system
                  </p>
                  <pre className="text-[11px] font-mono text-foreground/85 whitespace-pre-wrap break-words bg-primary/5 border border-primary/15 rounded-md p-2.5 max-h-48 overflow-auto">
                    {compiled.text}
                  </pre>
                </div>
              </div>
              {/* User bubble */}
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-nexus-amber/15 flex items-center justify-center shrink-0">
                  <UserIcon className="h-3 w-3 text-nexus-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-nexus-amber/80 mb-1">
                    user
                  </p>
                  <div className="text-xs text-foreground/90 bg-nexus-amber/5 border border-nexus-amber/20 rounded-md p-2.5 whitespace-pre-wrap break-words">
                    {userMessage.trim() || (
                      <span className="text-muted-foreground italic">(mensagem vazia)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="json" className="mt-3">
            <div className="relative rounded-lg border border-border/50 bg-secondary/30 max-h-[360px] overflow-auto">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => copy(payloadJson, 'json')}
                className="absolute top-1.5 right-1.5 h-6 gap-1 text-[10px]"
              >
                {copied === 'json' ? <Check className="h-3 w-3 text-nexus-emerald" /> : <Copy className="h-3 w-3" />}
                {copied === 'json' ? 'Copiado' : 'Copiar JSON'}
              </Button>
              <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre-wrap break-words p-3 pr-24">
                {payloadJson}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="curl" className="mt-3">
            <div className="relative rounded-lg border border-border/50 bg-secondary/30 max-h-[360px] overflow-auto">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => copy(curlCommand, 'curl')}
                className="absolute top-1.5 right-1.5 h-6 gap-1 text-[10px]"
              >
                {copied === 'curl' ? <Check className="h-3 w-3 text-nexus-emerald" /> : <Copy className="h-3 w-3" />}
                {copied === 'curl' ? 'Copiado' : 'Copiar cURL'}
              </Button>
              <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre-wrap break-words p-3 pr-24">
                {curlCommand}
              </pre>
              <p className="text-[10px] text-muted-foreground/70 px-3 pb-2 font-mono">
                Cole no terminal para reproduzir a chamada exatamente como o app faz.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Validation hints */}
      {!promptValid && (
        <div className="flex items-start gap-2 text-[11px] text-nexus-amber bg-nexus-amber/5 border border-nexus-amber/30 rounded-md p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Complete as 4 seções obrigatórias do system prompt antes de simular.</span>
        </div>
      )}
      {promptChangedAfterRun && (
        <div className="flex items-start gap-2 text-[11px] text-nexus-amber bg-nexus-amber/5 border border-nexus-amber/30 rounded-md p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>O prompt mudou desde a última simulação — re-rode o exemplo para revalidar.</span>
        </div>
      )}

      {/* Run button */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground/80 font-mono">
          modelo: {form.model} · max_tokens: {MAX_TOKENS}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={runSimulation}
          disabled={!canRun}
          aria-busy={loading}
          title={!promptValid ? 'Complete as 4 seções obrigatórias antes de simular' : undefined}
          className="gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Simulando…
            </>
          ) : result ? (
            <>
              <RotateCw className="h-3.5 w-3.5" /> Simular novamente
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" /> Simular envio real
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-md p-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Response panel */}
      {result && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 p-3 space-y-2 animate-page-enter"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] uppercase tracking-wider text-nexus-emerald font-semibold flex items-center gap-1.5">
              <Bot className="h-3 w-3" /> Resposta do agente
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <span>{formatLatency(result.latency_ms)}</span>
              <span className="opacity-50">·</span>
              <span>{result.input_tokens}→{result.output_tokens} tk</span>
              <span className="opacity-50">·</span>
              <span className="text-nexus-emerald">{formatBrl(result.cost_brl)}</span>
            </div>
          </div>
          <pre className="whitespace-pre-wrap break-words text-xs text-foreground font-sans leading-relaxed max-h-64 overflow-y-auto">
            {result.response || <span className="text-muted-foreground italic">(resposta vazia)</span>}
          </pre>
          <p className="text-[10px] font-mono text-muted-foreground/70 pt-1 border-t border-nexus-emerald/15">
            servido por: {result.model_used}
          </p>
        </div>
      )}
    </div>
  );
}
