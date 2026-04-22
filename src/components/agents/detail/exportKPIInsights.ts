/**
 * Exports the KPI window comparison (current vs previous) as CSV or PDF
 * straight from the browser. No backend round-trip.
 */
import jsPDF from 'jspdf';
import type { KPIInsight } from './kpiInsights';

export interface ExportContext {
  agentName: string;
  windowDays: number;
  threshold: number;
  generatedAt: Date;
}

function escapeCsv(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileSafe(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'agente';
}

function fmtDeltaPct(i: KPIInsight): string {
  if (!i.cmp.hasPrev) return 'sem dados';
  const sign = i.cmp.deltaPct >= 0 ? '+' : '';
  return `${sign}${i.cmp.deltaPct.toFixed(2)}%`;
}

function trendLabel(i: KPIInsight): string {
  if (!i.cmp.hasPrev) return '—';
  if (i.cmp.trend === 'flat') return 'estável';
  return i.cmp.trend === 'up' ? 'subiu' : 'caiu';
}

function judgmentLabel(i: KPIInsight, threshold: number): string {
  if (!i.cmp.hasPrev) return 'sem janela anterior';
  if (i.cmp.trend === 'flat' || Math.abs(i.cmp.deltaPct) < threshold) return 'sem mudança relevante';
  return i.cmp.isPositive ? 'positivo' : 'precisa atenção';
}

export function exportKPIInsightsCSV(insights: KPIInsight[], ctx: ExportContext) {
  const headerLines = [
    `# Comparativo de KPIs — ${ctx.agentName}`,
    `# Janela: ultimos ${ctx.windowDays}d vs ${ctx.windowDays}d anteriores`,
    `# Limiar de relevância: >=${ctx.threshold}%`,
    `# Gerado em: ${ctx.generatedAt.toISOString()}`,
    '',
  ];
  const cols = [
    'kpi',
    'valor_anterior',
    'valor_atual',
    'delta_pct',
    'tendencia',
    'avaliacao',
    'principais_causas',
    'sugestao',
  ];
  const rows = insights.map((i) => [
    i.label,
    i.previousLabel,
    i.currentLabel,
    fmtDeltaPct(i),
    trendLabel(i),
    judgmentLabel(i, ctx.threshold),
    i.causes.map((c) => `${c.headline}: ${c.detail}`).join(' | '),
    i.recommendation ?? '',
  ]);
  const csv = [
    ...headerLines,
    cols.join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  downloadBlob(
    blob,
    `kpi-comparativo-${fileSafe(ctx.agentName)}-${ctx.windowDays}d.csv`,
  );
}

export function exportKPIInsightsPDF(insights: KPIInsight[], ctx: ExportContext) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, fontSize: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...(opts.color ?? [30, 30, 30]));
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize * 1.35;
    ensureSpace(lines.length * lineHeight);
    lines.forEach((line) => {
      doc.text(line, margin, y);
      y += lineHeight;
    });
  };

  // Header
  writeWrapped('Comparativo de KPIs', 18, { bold: true, color: [20, 20, 20] });
  writeWrapped(`Agente: ${ctx.agentName}`, 11, { color: [80, 80, 80] });
  writeWrapped(
    `Janela: últimos ${ctx.windowDays}d vs ${ctx.windowDays}d anteriores  ·  Limiar: ≥${ctx.threshold}%`,
    10,
    { color: [110, 110, 110] },
  );
  writeWrapped(`Gerado em: ${ctx.generatedAt.toLocaleString('pt-BR')}`, 9, { color: [140, 140, 140] });
  y += 8;

  // Summary table (manual, no autotable dep)
  const colWidths = [120, 95, 95, 75, 105]; // kpi, prev, curr, delta, avaliação
  const headers = ['KPI', 'Anterior', 'Atual', 'Δ %', 'Avaliação'];
  const drawRow = (cells: string[], opts: { header?: boolean } = {}) => {
    const lineHeight = 12;
    const wrapped = cells.map((c, i) => doc.splitTextToSize(c, colWidths[i] - 8) as string[]);
    const rowHeight = Math.max(...wrapped.map((w) => w.length)) * lineHeight + 8;
    ensureSpace(rowHeight);
    if (opts.header) {
      doc.setFillColor(235, 238, 245);
      doc.rect(margin, y - 10, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y - 10, margin + contentWidth, y - 10);
    let x = margin + 4;
    doc.setFont('helvetica', opts.header ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    wrapped.forEach((linesForCell, idx) => {
      let cellY = y;
      linesForCell.forEach((line) => {
        doc.text(line, x, cellY);
        cellY += lineHeight;
      });
      x += colWidths[idx];
    });
    y += rowHeight;
  };

  drawRow(headers, { header: true });
  insights.forEach((i) => {
    drawRow([
      i.label,
      i.previousLabel,
      i.currentLabel,
      fmtDeltaPct(i),
      judgmentLabel(i, ctx.threshold),
    ]);
  });

  y += 14;
  writeWrapped('Diagnóstico detalhado', 13, { bold: true, color: [20, 20, 20] });
  y += 4;

  insights.forEach((i) => {
    ensureSpace(60);
    writeWrapped(`${i.label} — ${i.previousLabel} → ${i.currentLabel} (${fmtDeltaPct(i)})`, 11, {
      bold: true,
      color: [25, 25, 25],
    });
    if (!i.cmp.hasPrev) {
      writeWrapped('Sem janela anterior suficiente para diagnóstico.', 9, { color: [110, 110, 110] });
    } else if (i.cmp.trend === 'flat' || Math.abs(i.cmp.deltaPct) < ctx.threshold) {
      writeWrapped(
        `Sem mudança relevante (variação abaixo do limiar de ≥${ctx.threshold}%).`,
        9,
        { color: [110, 110, 110] },
      );
    } else {
      i.causes.forEach((c) => {
        const tone: [number, number, number] =
          c.tone === 'negative' ? [180, 40, 50] : c.tone === 'positive' ? [30, 130, 80] : [90, 90, 90];
        writeWrapped(`• ${c.headline}`, 9.5, { bold: true, color: tone });
        writeWrapped(`  ${c.detail}`, 9, { color: [70, 70, 70] });
      });
      if (i.recommendation) {
        writeWrapped(`Sugestão: ${i.recommendation}`, 9, { color: [40, 70, 140] });
      }
    }
    y += 8;
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Superagent Lab · Página ${p} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 18,
      { align: 'center' },
    );
  }

  doc.save(`kpi-comparativo-${fileSafe(ctx.agentName)}-${ctx.windowDays}d.pdf`);
}
