import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, Eye, FileText, Sparkles } from 'lucide-react';
import { compilePrompt } from '@/lib/promptCompiler';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import {
  REQUIRED_PROMPT_SECTIONS,
  analyzeSectionContent,
  type PromptSectionKey,
} from '@/lib/validations/quickAgentSchema';
import { cn } from '@/lib/utils';

interface Props {
  form: QuickAgentForm;
  defaultOpen?: boolean;
  /** Indicates the source of the most recent prompt change — drives auto-expand + pulse. */
  lastChangeKind?: 'variant' | 'manual' | null;
  /** Label of the active variant (e.g. "Conciso") to display when expanded. */
  activeVariantLabel?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFmt(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-secondary text-primary text-[11px] font-mono">$1</code>')
    .replace(/\{\{([^}]+)\}\}/g, '<span class="px-1 py-0.5 rounded bg-nexus-amber/15 text-nexus-amber font-mono text-[11px]">{{$1}}</span>');
}

function renderMarkdown(text: string, thinByHeading: Map<number, ThinHit> = new Map()): React.ReactNode {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];

  // We accumulate nodes belonging to the current `##` section so we can wrap
  // a *whole block* (heading + body) inside a highlight container when that
  // section is flagged as thin. `currentSection` is null while we're outside
  // any tracked section (e.g. the preamble).
  let bucket: React.ReactNode[] = [];
  let bucketHeadingLine: number | null = null;
  let bucketKey = 0;

  const flushBucket = () => {
    if (bucket.length === 0) {
      bucketHeadingLine = null;
      return;
    }
    const thin = bucketHeadingLine !== null ? thinByHeading.get(bucketHeadingLine) : undefined;
    if (thin) {
      out.push(
        <div
          key={`thin-${bucketKey++}`}
          data-thin-section={thin.key}
          className="rounded-md border border-nexus-amber/40 bg-nexus-amber/5 px-2.5 py-2 my-1.5 relative"
        >
          <span
            className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full border border-nexus-amber/40 bg-nexus-amber/15 text-nexus-amber inline-flex items-center gap-1"
            title={thin.reason}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            thin · {thin.words}p
          </span>
          {bucket}
        </div>,
      );
    } else {
      out.push(<div key={`sec-${bucketKey++}`}>{bucket}</div>);
    }
    bucket = [];
    bucketHeadingLine = null;
  };

  const flushList = (key: string) => {
    if (listBuf.length === 0) return;
    bucket.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-0.5 my-1.5 text-foreground/90">
        {listBuf.map((it, i) => (
          <li key={i} className="text-xs" dangerouslySetInnerHTML={{ __html: inlineFmt(it) }} />
        ))}
      </ul>,
    );
    listBuf = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuf.push(line.slice(2));
      return;
    }
    flushList(String(i));

    if (line.startsWith('### ')) {
      bucket.push(<h4 key={i} className="text-xs font-heading font-semibold text-foreground mt-2.5">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      // Boundary between sections — flush whatever we had and start a new
      // bucket whose first child is this heading.
      flushList('pre-h2-' + i);
      flushBucket();
      bucketHeadingLine = i;
      bucket.push(<h3 key={i} className="text-sm font-heading font-semibold text-foreground mt-3">{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      bucket.push(<h2 key={i} className="text-base font-heading font-bold text-foreground mt-3">{line.slice(2)}</h2>);
    } else if (line.startsWith('> ')) {
      bucket.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-2.5 text-muted-foreground italic my-1.5 text-xs">
          {line.slice(2)}
        </blockquote>,
      );
    } else if (line.startsWith('<!--')) {
      bucket.push(<p key={i} className="text-[10px] text-muted-foreground/60 font-mono mt-2">{line}</p>);
    } else if (line === '') {
      bucket.push(<div key={i} className="h-1.5" />);
    } else {
      bucket.push(
        <p key={i} className="text-xs text-foreground/85 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFmt(line) }} />,
      );
    }
  });
  flushList('end');
  flushBucket();
  return out;
}

interface ThinHit {
  key: PromptSectionKey;
  label: string;
  words: number;
  reason: string;
}

export function CompiledPromptPreview({ form, defaultOpen = false, lastChangeKind = null, activeVariantLabel = null }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [tokenDelta, setTokenDelta] = useState<number | null>(null);

  const compiled = useMemo(() => compilePrompt(form), [form]);

  // Map every thin section back to its heading line *inside the compiled text*
  // so we can wrap the corresponding rendered block with a warning highlight.
  // We re-scan compiled.text (instead of just form.prompt) because the
  // compiler may inject preamble/headers — line numbers must match what
  // renderMarkdown will iterate over.
  const thinByHeading = useMemo(() => {
    const map = new Map<number, ThinHit>();
    const reports = analyzeSectionContent(compiled.text);
    const thin = reports.filter((r) => r.present && !!r.thinReason);
    if (thin.length === 0) return map;

    const lines = compiled.text.split('\n');
    const stripAccents = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^##\s+(.+?)\s*$/);
      if (!m) continue;
      const norm = stripAccents(m[1]);
      const hit = thin.find((t) => {
        const sec = REQUIRED_PROMPT_SECTIONS.find((s) => s.key === t.key);
        return sec ? sec.aliases.some((a) => norm.includes(a)) : false;
      });
      if (hit && !Array.from(map.values()).some((v) => v.key === hit.key)) {
        map.set(i, {
          key: hit.key,
          label: hit.label,
          words: hit.wordCount,
          reason: hit.thinReason ?? 'Conteúdo insuficiente',
        });
      }
    }
    return map;
  }, [compiled.text]);
  const thinCount = thinByHeading.size;

  const prevTokensRef = useRef<number>(compiled.stats.estimatedTokens);
  const initRef = useRef(true);

  useEffect(() => {
    if (initRef.current) {
      initRef.current = false;
      prevTokensRef.current = compiled.stats.estimatedTokens;
      return;
    }
    const delta = compiled.stats.estimatedTokens - prevTokensRef.current;
    prevTokensRef.current = compiled.stats.estimatedTokens;
    if (delta === 0) return;
    setTokenDelta(delta);
    setPulse(true);
    const t1 = window.setTimeout(() => setPulse(false), 700);
    const t2 = window.setTimeout(() => setTokenDelta(null), 2400);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [compiled.stats.estimatedTokens]);

  useEffect(() => {
    if (lastChangeKind === 'variant' && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChangeKind]);

  // Auto-expand once when a thin section first appears, so the user actually
  // sees the highlight without manually opening the preview.
  const prevThinCountRef = useRef(thinCount);
  useEffect(() => {
    if (prevThinCountRef.current === 0 && thinCount > 0 && !open) setOpen(true);
    prevThinCountRef.current = thinCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinCount]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compiled.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* ignore */}
  };

  const hasUnresolved = compiled.unresolvedVariables.length > 0;
  const resolvedCount = compiled.detectedVariables.length - compiled.unresolvedVariables.length;
  const unresolvedCount = compiled.unresolvedVariables.length;

  return (
    <div
      className={cn(
        'nexus-card border-primary/20 transition-shadow duration-300',
        pulse && 'ring-2 ring-primary/40 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-heading font-semibold text-foreground">
              Prévia do prompt consolidado
            </p>
            <p className="text-[11px] text-muted-foreground">
              Como o LLM vai receber as instruções no momento de salvar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {resolvedCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald"
              title={`${resolvedCount} variável(eis) resolvida(s)`}
            >
              ✓ {resolvedCount}
            </span>
          )}
          {unresolvedCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber"
              title={`${unresolvedCount} variável(eis) sem valor`}
            >
              ⚠ {unresolvedCount}
            </span>
          )}
          {thinCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-nexus-amber/40 bg-nexus-amber/15 text-nexus-amber inline-flex items-center gap-1"
              title={`${thinCount} seção(ões) com conteúdo insuficiente — destacadas no preview`}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {thinCount} thin
            </span>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            ~{compiled.stats.estimatedTokens.toLocaleString('pt-BR')} tokens
          </Badge>
          {tokenDelta !== null && tokenDelta !== 0 && (
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded-full animate-fade-in',
                tokenDelta > 0
                  ? 'bg-nexus-emerald/10 text-nexus-emerald border border-nexus-emerald/30'
                  : 'bg-destructive/10 text-destructive border border-destructive/30',
              )}
              title="Variação no total de tokens desde a última mudança"
            >
              {tokenDelta > 0 ? '+' : ''}{tokenDelta.toLocaleString('pt-BR')}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3 animate-page-enter">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-secondary/40">
              <button
                type="button"
                onClick={() => setView('preview')}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md transition-colors',
                  view === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Eye className="h-3 w-3" /> Renderizado
              </button>
              <button
                type="button"
                onClick={() => setView('raw')}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md transition-colors',
                  view === 'raw' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <FileText className="h-3 w-3" /> Texto bruto
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeVariantLabel && (
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                  Aplicado: {activeVariantLabel}
                </Badge>
              )}
              <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-nexus-emerald" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado!' : 'Copiar prompt final'}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-1.5 flex-wrap text-[11px]">
            <span className="text-muted-foreground mt-0.5">Variáveis:</span>
            {compiled.detectedVariables.length === 0 ? (
              <span className="text-muted-foreground/70 italic">nenhuma detectada</span>
            ) : (
              compiled.detectedVariables.map((v) => {
                const unresolved = compiled.unresolvedVariables.includes(v);
                return (
                  <span
                    key={v}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono border text-[10px]',
                      unresolved
                        ? 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber'
                        : 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald',
                    )}
                    title={unresolved ? 'Sem valor — ficará literal' : 'Substituída ao salvar'}
                  >
                    {unresolved ? '⚠' : '✓'} {`{{${v}}}`}
                  </span>
                );
              })
            )}
          </div>

          {hasUnresolved && (
            <div className="text-[11px] text-nexus-amber bg-nexus-amber/10 border border-nexus-amber/30 rounded-md px-2.5 py-1.5">
              {compiled.unresolvedVariables.length} variável(eis) sem valor permanecerão literais no prompt salvo.
            </div>
          )}

          <div
            className="rounded-lg border border-border/50 bg-secondary/30 p-3.5 max-h-[420px] overflow-auto"
            aria-live="polite"
          >
            {view === 'preview' ? (
              <div className="space-y-0.5">{renderMarkdown(compiled.text)}</div>
            ) : (
              <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre-wrap break-words">
                {compiled.text}
              </pre>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono flex-wrap">
            <span>{compiled.stats.chars.toLocaleString('pt-BR')} chars</span>
            <span>·</span>
            <span>{compiled.stats.words.toLocaleString('pt-BR')} palavras</span>
            <span>·</span>
            <span>{compiled.stats.lines.toLocaleString('pt-BR')} linhas</span>
            <span>·</span>
            <span>~{compiled.stats.estimatedTokens.toLocaleString('pt-BR')} tokens</span>
          </div>
        </div>
      )}
    </div>
  );
}
