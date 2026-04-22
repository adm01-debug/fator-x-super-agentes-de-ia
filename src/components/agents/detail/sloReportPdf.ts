import jsPDF from 'jspdf';
import type { SLOMetrics, ViolationDay, DailyPoint } from './agentMetricsHelpers';
import type { SLOTargetsConfig } from '@/hooks/useAgentSLOTargets';

export interface SLOReportInput {
  agentName: string;
  windowLabel: string;
  windowTraces: number;
  generatedAt: Date;
  slo: SLOMetrics;
  targets: SLOTargetsConfig;
  burn: { consumedPct: number; daysToExhaustion: number | null; status: 'healthy' | 'warning' | 'critical' };
  timeline: ViolationDay[];
  daily: DailyPoint[];
}

const COLORS = {
  text: [20, 20, 28] as [number, number, number],
  muted: [110, 110, 125] as [number, number, number],
  rule: [220, 220, 228] as [number, number, number],
  emerald: [16, 163, 127] as [number, number, number],
  amber: [217, 145, 23] as [number, number, number],
  red: [220, 53, 69] as [number, number, number],
  primary: [99, 102, 241] as [number, number, number],
};

function statusColor(status: 'healthy' | 'warning' | 'critical') {
  if (status === 'critical') return COLORS.red;
  if (status === 'warning') return COLORS.amber;
  return COLORS.emerald;
}

function latencyStatus(value: number, target: number): 'healthy' | 'warning' | 'critical' {
  if (value === 0 || value <= target) return 'healthy';
  if (value <= target * 1.5) return 'warning';
  return 'critical';
}

function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR');
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function generateSLOReportPdf(input: SLOReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const setColor = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  // Header
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Relatório SLO', M, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(COLORS.muted);
  doc.text(`Agente: ${input.agentName}`, M, y); y += 13;
  doc.text(`Janela: ${input.windowLabel} · ${fmtNum(input.windowTraces)} traces`, M, y); y += 13;
  doc.text(`Gerado em: ${fmtDateTime(input.generatedAt)}`, M, y); y += 16;

  setDraw(COLORS.rule);
  doc.line(M, y, pageW - M, y);
  y += 18;

  // Section: Metas atuais
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Metas atuais', M, y); y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(COLORS.muted);
  const metas = [
    `p50 ≤ ${fmtNum(input.targets.p50)}ms`,
    `p95 ≤ ${fmtNum(input.targets.p95)}ms`,
    `p99 ≤ ${fmtNum(input.targets.p99)}ms`,
    `Disponibilidade ≥ ${input.targets.availability.toFixed(1)}%`,
    `Error budget ≤ ${input.targets.errorBudget.toFixed(1)}%`,
  ];
  metas.forEach((m) => { doc.text(`• ${m}`, M + 8, y); y += 13; });
  y += 8;

  // Section: Resultados na janela
  ensureSpace(160);
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resultados observados', M, y); y += 16;

  // Cards: 2 columns x 2 rows
  const cardW = (pageW - M * 2 - 12) / 2;
  const cardH = 56;
  const cards = [
    { label: 'Latência p50', value: `${fmtNum(Math.round(input.slo.p50))}ms`, target: `alvo ${fmtNum(input.targets.p50)}ms`,
      status: latencyStatus(input.slo.p50, input.targets.p50) },
    { label: 'Latência p95', value: `${fmtNum(Math.round(input.slo.p95))}ms`, target: `alvo ${fmtNum(input.targets.p95)}ms`,
      status: latencyStatus(input.slo.p95, input.targets.p95) },
    { label: 'Latência p99', value: `${fmtNum(Math.round(input.slo.p99))}ms`, target: `alvo ${fmtNum(input.targets.p99)}ms`,
      status: latencyStatus(input.slo.p99, input.targets.p99) },
    { label: 'Disponibilidade', value: `${input.slo.successRate.toFixed(2)}%`, target: `alvo ${input.targets.availability.toFixed(1)}%`,
      status: input.slo.successRate >= input.targets.availability ? 'healthy'
        : input.slo.successRate >= input.targets.availability * 0.99 ? 'warning' : 'critical' },
  ] as const;

  cards.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (cardW + 12);
    const cy = y + row * (cardH + 10);
    setDraw(COLORS.rule);
    setFill([250, 250, 252]);
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, 'FD');
    setColor(COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(c.label, x + 10, cy + 14);
    setColor(statusColor(c.status));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(c.value, x + 10, cy + 34);
    setColor(COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(c.target, x + 10, cy + 48);
  });
  y += cardH * 2 + 10 + 14;

  // Section: Error budget burn
  ensureSpace(90);
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Error budget burn', M, y); y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(COLORS.muted);
  doc.text(
    `Consumido: ${input.burn.consumedPct.toFixed(0)}% do budget · taxa de erro ${input.slo.errorRate.toFixed(2)}% / meta ${input.targets.errorBudget.toFixed(1)}%`,
    M, y,
  ); y += 14;

  // Burn bar
  const barW = pageW - M * 2;
  const barH = 8;
  setFill([235, 235, 240]);
  doc.roundedRect(M, y, barW, barH, 3, 3, 'F');
  const fillW = Math.max(0, Math.min(1, input.burn.consumedPct / 100)) * barW;
  setFill(statusColor(input.burn.status));
  if (fillW > 0) doc.roundedRect(M, y, fillW, barH, 3, 3, 'F');
  y += barH + 14;

  setColor(COLORS.muted);
  doc.setFontSize(9);
  const exhaust = input.burn.daysToExhaustion;
  const exhaustText = exhaust === null
    ? 'Sem dados suficientes para previsão de exaustão.'
    : exhaust <= 0
    ? 'Budget já esgotado neste período.'
    : `Em ritmo atual, exaustão em ~${exhaust} dia${exhaust !== 1 ? 's' : ''}.`;
  doc.text(exhaustText, M, y); y += 18;

  // Section: Piores períodos da timeline
  ensureSpace(90);
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Piores períodos da timeline', M, y); y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(COLORS.muted);
  doc.text('Top 5 buckets ordenados por severidade (p99 + erros pesam mais).', M, y); y += 14;

  const ranked = [...input.timeline]
    .map((d) => ({
      ...d,
      severity: d.p95Violations + d.p99Violations * 2 + d.errors * 2,
    }))
    .filter((d) => d.severity > 0 || d.total > 0)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5);

  if (ranked.length === 0) {
    setColor(COLORS.muted);
    doc.text('Nenhuma violação registrada na janela selecionada — tudo dentro das metas.', M, y);
    y += 16;
  } else {
    // Table header
    const cols = [
      { h: 'Período', x: M, w: 90 },
      { h: 'Traces', x: M + 90, w: 60 },
      { h: '> p95', x: M + 150, w: 60 },
      { h: '> p99', x: M + 210, w: 60 },
      { h: 'Erros', x: M + 270, w: 60 },
      { h: 'Severidade', x: M + 330, w: 80 },
    ];
    setColor(COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    cols.forEach((c) => doc.text(c.h, c.x, y));
    y += 4;
    setDraw(COLORS.rule);
    doc.line(M, y, pageW - M, y); y += 12;

    doc.setFont('helvetica', 'normal');
    ranked.forEach((d) => {
      ensureSpace(16);
      const status: 'healthy' | 'warning' | 'critical' =
        d.errors > 0 || d.p99Violations > 0 ? 'critical'
        : d.p95Violations > 0 ? 'warning'
        : 'healthy';
      setColor(COLORS.text);
      doc.text(d.label, cols[0].x, y);
      doc.text(fmtNum(d.total), cols[1].x, y);
      setColor(d.p95Violations > 0 ? COLORS.amber : COLORS.muted);
      doc.text(fmtNum(d.p95Violations), cols[2].x, y);
      setColor(d.p99Violations > 0 ? COLORS.red : COLORS.muted);
      doc.text(fmtNum(d.p99Violations), cols[3].x, y);
      setColor(d.errors > 0 ? COLORS.red : COLORS.muted);
      doc.text(fmtNum(d.errors), cols[4].x, y);
      setColor(statusColor(status));
      doc.text(fmtNum(d.severity), cols[5].x, y);
      y += 14;
    });
  }
  y += 10;

  // Section: distribuição de traces
  ensureSpace(80);
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Distribuição de traces', M, y); y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(COLORS.muted);
  const total = input.slo.totalTraces || 0;
  const successPct = total > 0 ? (input.slo.successCount / total) * 100 : 0;
  const warnPct = total > 0 ? (input.slo.warningCount / total) * 100 : 0;
  const errPct = total > 0 ? (input.slo.errorCount / total) * 100 : 0;
  doc.text(`Total: ${fmtNum(total)} traces · sucesso ${fmtNum(input.slo.successCount)} (${successPct.toFixed(1)}%) · avisos ${fmtNum(input.slo.warningCount)} (${warnPct.toFixed(1)}%) · erros ${fmtNum(input.slo.errorCount)} (${errPct.toFixed(1)}%)`, M, y, { maxWidth: pageW - M * 2 });
  y += 24;

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setColor(COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Relatório SLO · ${input.agentName} · página ${p}/${pageCount}`, M, pageH - 18);
    doc.text(fmtDateTime(input.generatedAt), pageW - M, pageH - 18, { align: 'right' });
  }

  return doc;
}
