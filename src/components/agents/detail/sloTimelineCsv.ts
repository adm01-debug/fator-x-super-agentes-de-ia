/**
 * Builds a CSV from the current SLO violation timeline buckets.
 * Columns include bucket time range, trace counts, latency percentiles,
 * thresholds, matched rules, and per-rule classification flags.
 */
import type { ViolationDay } from './agentMetricsHelpers';

const RULE_LABEL: Record<string, string> = {
  p95: 'Latência p95',
  p99: 'Latência p99 / Crítico',
  error: 'Erro',
};

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildTimelineCsv(
  buckets: ViolationDay[],
  bucketMs: number,
  meta: { agentName: string; windowLabel: string; generatedAt: Date },
): string {
  const headerLines = [
    `# Relatório de Timeline SLO`,
    `# Agente: ${meta.agentName}`,
    `# Janela: ${meta.windowLabel}`,
    `# Buckets: ${buckets.length}`,
    `# Gerado em: ${meta.generatedAt.toISOString()}`,
    '',
  ];

  const columns = [
    'bucket_inicio_iso',
    'bucket_fim_iso',
    'rotulo',
    'total_traces',
    'p50_ms',
    'p95_ms',
    'max_latencia_ms',
    'limite_p95_ms',
    'limite_p99_ms',
    'violacoes_p95',
    'violacoes_p99',
    'erros',
    'classificacao',
    'regras_correspondidas',
    'flag_p95',
    'flag_p99',
    'flag_erro',
  ];

  const rows = buckets.map((b) => {
    const startMs = new Date(b.date).getTime();
    const endIso = new Date(startMs + bucketMs).toISOString();
    const classification =
      b.errors > 0 || b.p99Violations > 0 ? 'critico' : b.p95Violations > 0 ? 'atencao' : 'saudavel';
    const matched = b.matchedRules.map((r) => RULE_LABEL[r] ?? r).join(' | ');
    return [
      b.date,
      endIso,
      b.label,
      b.total,
      b.p50Ms,
      b.p95Ms,
      b.maxLatencyMs,
      b.thresholds.p95,
      b.thresholds.p99,
      b.p95Violations,
      b.p99Violations,
      b.errors,
      classification,
      matched,
      b.matchedRules.includes('p95') ? 1 : 0,
      b.matchedRules.includes('p99') ? 1 : 0,
      b.matchedRules.includes('error') ? 1 : 0,
    ].map(csvEscape).join(',');
  });

  return [...headerLines, columns.join(','), ...rows].join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel reads UTF-8 accents correctly
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
