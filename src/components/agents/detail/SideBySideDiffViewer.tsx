/**
 * SideBySideDiffViewer — visualizador de diff em duas colunas, com realce
 * em nível de palavra/token dos trechos alterados. Usado antes da
 * confirmação de rollback para que o usuário inspecione exatamente o que
 * será modificado em prompts e parâmetros do modelo.
 *
 * - Para texto livre (prompt, missão, persona) → diff por palavras.
 * - Para JSON / objetos / arrays → diff por linha após pretty-print.
 * - Para escalares simples (números, strings curtas) → diff por palavras.
 *
 * O destaque acontece DENTRO de cada linha — não basta marcar a linha
 * inteira como adicionada/removida, queremos ver qual trecho mudou.
 */
import { useMemo } from 'react';
import { diffLines, diffWordsWithSpace, type Change } from 'diff';
import { ArrowLeftRight, FileText, Cpu } from 'lucide-react';
import type { FieldChange } from './restoreDiffHelpers';

interface Props {
  /** Mudanças a renderizar — só prompt + parâmetros do modelo aparecem. */
  changes: FieldChange[];
  /** Versões para o cabeçalho — informativo. */
  currentVersion: number;
  sourceVersion: number;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Normalização de valores em texto multi-linha                      */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Converte qualquer valor numa string adequada para diff. JSON é
 * pretty-printed (uma propriedade por linha), o que permite que o
 * diff destaque exatamente o campo alterado dentro de um objeto de
 * parâmetros do modelo.
 */
function toText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Heurística para decidir entre diff por linhas (estruturado) e por palavras (texto). */
function isStructured(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'object') return true;
  // Strings que parecem JSON também ganham diff por linha.
  if (typeof v === 'string') {
    const t = v.trim();
    return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Realce intra-linha (palavra a palavra)                            */
/* ─────────────────────────────────────────────────────────────────── */

interface InlineSegment {
  text: string;
  /** 'same' aparece nos dois lados; 'removed' só na esquerda; 'added' só na direita. */
  kind: 'same' | 'removed' | 'added';
}

/**
 * Para cada par (linha original / linha modificada) calcula um diff por
 * palavras para destacar apenas os tokens alterados — em vez de marcar
 * a linha inteira. Usado tanto em texto livre quanto na renderização
 * lado-a-lado de blocos JSON.
 */
function inlineWordDiff(before: string, after: string): { left: InlineSegment[]; right: InlineSegment[] } {
  const parts = diffWordsWithSpace(before, after);
  const left: InlineSegment[] = [];
  const right: InlineSegment[] = [];
  for (const p of parts) {
    if (p.added) {
      right.push({ text: p.value, kind: 'added' });
    } else if (p.removed) {
      left.push({ text: p.value, kind: 'removed' });
    } else {
      left.push({ text: p.value, kind: 'same' });
      right.push({ text: p.value, kind: 'same' });
    }
  }
  return { left, right };
}

function renderSegments(segments: InlineSegment[], side: 'left' | 'right') {
  if (segments.length === 0) return <span className="opacity-40">∅</span>;
  return segments.map((s, i) => {
    if (s.kind === 'same') return <span key={i}>{s.text}</span>;
    const cls =
      s.kind === 'removed'
        ? 'bg-destructive/25 text-destructive rounded px-0.5'
        : 'bg-nexus-emerald/25 text-nexus-emerald rounded px-0.5';
    // Só renderiza o segmento no lado correto — proteção extra
    // contra inconsistências.
    if (s.kind === 'removed' && side !== 'left') return null;
    if (s.kind === 'added' && side !== 'right') return null;
    return (
      <span key={i} className={cls}>
        {s.text}
      </span>
    );
  });
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Renderização lado a lado para blocos estruturados (JSON)          */
/* ─────────────────────────────────────────────────────────────────── */

interface AlignedRow {
  left: { line: string; kind: 'same' | 'removed' | 'empty' };
  right: { line: string; kind: 'same' | 'added' | 'empty' };
}

/**
 * Alinha duas versões de um texto multilinha em pares de linhas para a
 * visualização lado a lado. Usa o resultado de `diffLines` e expande os
 * blocos de mudança intercalando placeholders vazios para manter as
 * linhas correspondentes alinhadas verticalmente — o padrão GitHub.
 */
function alignLines(before: string, after: string): AlignedRow[] {
  const parts: Change[] = diffLines(before, after, { newlineIsToken: false });
  const rows: AlignedRow[] = [];

  // Buffers para combinar uma sequência de removed seguida por added,
  // produzindo linhas pareadas ao invés de um lado vazio.
  let pendingRemoved: string[] = [];
  let pendingAdded: string[] = [];

  const flushPending = () => {
    const max = Math.max(pendingRemoved.length, pendingAdded.length);
    for (let i = 0; i < max; i++) {
      const l = pendingRemoved[i];
      const r = pendingAdded[i];
      rows.push({
        left: l !== undefined
          ? { line: l, kind: 'removed' }
          : { line: '', kind: 'empty' },
        right: r !== undefined
          ? { line: r, kind: 'added' }
          : { line: '', kind: 'empty' },
      });
    }
    pendingRemoved = [];
    pendingAdded = [];
  };

  const splitLines = (value: string): string[] => {
    // Mantém quebras de linha sem produzir linha extra vazia no final.
    const lines = value.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  };

  for (const p of parts) {
    const lines = splitLines(p.value);
    if (p.added) {
      pendingAdded.push(...lines);
    } else if (p.removed) {
      pendingRemoved.push(...lines);
    } else {
      flushPending();
      for (const line of lines) {
        rows.push({
          left: { line, kind: 'same' },
          right: { line, kind: 'same' },
        });
      }
    }
  }
  flushPending();
  return rows;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Bloco principal por campo                                         */
/* ─────────────────────────────────────────────────────────────────── */

function FieldDiff({ change }: { change: FieldChange }) {
  const beforeText = toText(change.before);
  const afterText = toText(change.after);

  // Decide o modo: estruturado (linha-a-linha alinhado) ou prosa (palavra-a-palavra).
  const useStructured = isStructured(change.before) || isStructured(change.after);

  const stats = useMemo(() => {
    // Conta tokens alterados para o cabeçalho — útil para o usuário
    // sentir o tamanho da mudança antes mesmo de ler.
    const parts = diffWordsWithSpace(beforeText, afterText);
    let adds = 0;
    let rems = 0;
    for (const p of parts) {
      const len = p.value.length;
      if (p.added) adds += len;
      else if (p.removed) rems += len;
    }
    return { adds, rems };
  }, [beforeText, afterText]);

  const Icon = change.group === 'prompt' ? FileText : Cpu;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card/30">
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/40 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground truncate">{change.label}</span>
          <span className="text-[10px] font-mono uppercase text-muted-foreground/70">
            {change.group}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
          <span className="text-destructive">−{compactCount(stats.rems)}</span>
          <span className="text-nexus-emerald">+{compactCount(stats.adds)}</span>
        </div>
      </header>

      {useStructured ? (
        <StructuredSideBySide before={beforeText} after={afterText} />
      ) : (
        <ProseSideBySide before={beforeText} after={afterText} />
      )}
    </div>
  );
}

function compactCount(n: number): string {
  // Formata contagem de chars de forma compacta — "1.2k" para >999.
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Lado-a-lado para PROSA (prompts)                                  */
/* ─────────────────────────────────────────────────────────────────── */

function ProseSideBySide({ before, after }: { before: string; after: string }) {
  const { left, right } = useMemo(() => inlineWordDiff(before, after), [before, after]);

  if (!before && !after) {
    return (
      <p className="p-3 text-[11px] text-muted-foreground italic">
        Conteúdo vazio nos dois lados.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-border/50 max-h-72 overflow-auto bg-background/40">
      <div className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5 not-italic">
          Antes
        </p>
        {before ? renderSegments(left, 'left') : <span className="opacity-40">∅</span>}
      </div>
      <div className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5 not-italic">
          Depois
        </p>
        {after ? renderSegments(right, 'right') : <span className="opacity-40">∅</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Lado-a-lado para BLOCOS ESTRUTURADOS (JSON / parâmetros)          */
/* ─────────────────────────────────────────────────────────────────── */

function StructuredSideBySide({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => alignLines(before, after), [before, after]);

  if (rows.length === 0) {
    return (
      <p className="p-3 text-[11px] text-muted-foreground italic">
        Conteúdo vazio nos dois lados.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto bg-background/40">
      <table className="w-full text-[11px] font-mono leading-relaxed border-collapse">
        <colgroup>
          <col style={{ width: '50%' }} />
          <col style={{ width: '50%' }} />
        </colgroup>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="align-top">
              <td
                className={`px-3 py-0.5 border-r border-border/40 whitespace-pre-wrap break-words ${
                  row.left.kind === 'removed'
                    ? 'bg-destructive/10 text-destructive'
                    : row.left.kind === 'empty'
                      ? 'bg-background/20'
                      : 'text-foreground/80'
                }`}
              >
                {row.left.kind === 'removed' && row.right.kind === 'added' ? (
                  // Diff intra-linha quando temos par alinhado (modificação real).
                  renderSegments(inlineWordDiff(row.left.line, row.right.line).left, 'left')
                ) : row.left.kind === 'empty' ? (
                  <span className="opacity-30 select-none">·</span>
                ) : (
                  row.left.line || '\u00A0'
                )}
              </td>
              <td
                className={`px-3 py-0.5 whitespace-pre-wrap break-words ${
                  row.right.kind === 'added'
                    ? 'bg-nexus-emerald/10 text-nexus-emerald'
                    : row.right.kind === 'empty'
                      ? 'bg-background/20'
                      : 'text-foreground/80'
                }`}
              >
                {row.left.kind === 'removed' && row.right.kind === 'added' ? (
                  renderSegments(inlineWordDiff(row.left.line, row.right.line).right, 'right')
                ) : row.right.kind === 'empty' ? (
                  <span className="opacity-30 select-none">·</span>
                ) : (
                  row.right.line || '\u00A0'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Componente exportado                                              */
/* ─────────────────────────────────────────────────────────────────── */

export function SideBySideDiffViewer({ changes, currentVersion, sourceVersion }: Props) {
  // Só nos importam mudanças de prompt e parâmetros do modelo.
  const relevant = changes.filter((c) => c.group === 'prompt' || c.group === 'model');

  if (relevant.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/30 p-6 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhuma mudança em prompt ou parâmetros nas opções selecionadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
          <span>
            Comparando{' '}
            <span className="font-mono text-destructive">v{currentVersion}</span> (atual) com{' '}
            <span className="font-mono text-nexus-emerald">v{sourceVersion}</span> (origem)
          </span>
        </div>
        <span className="font-mono text-[10px]">
          {relevant.length} campo{relevant.length === 1 ? '' : 's'}
        </span>
      </div>

      {relevant.map((c) => (
        <FieldDiff key={`${c.group}-${c.field}`} change={c} />
      ))}
    </div>
  );
}
