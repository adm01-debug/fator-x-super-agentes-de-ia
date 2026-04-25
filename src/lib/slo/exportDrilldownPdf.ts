/**
 * exportDrilldownPdf — Generates a shareable PDF report of the SLO drill-down
 * (top 3 contributors per KPI) with absolute deep-links back into the app.
 *
 * Pure client-side via jsPDF. No autoTable plugin needed — we render rows
 * by hand to keep the bundle lean and the layout precise.
 */
import { jsPDF } from 'jspdf';

export interface DrilldownContributor {
  rank: number;
  label: string;
  detail: string;
  deltaLabel: string;
  href: string;
  worse: boolean;
}

export interface DrilldownSection {
  title: string;
  kpi: string;
  rows: DrilldownContributor[];
  empty: string;
}

/**
 * Snapshot of the "tool failures" toggle and the totals it produces for the
 * current drill-down window. Surfaces in the PDF so reviewers can tell at a
 * glance whether tool errors are inflating (or hidden from) the metrics.
 */
export interface ToolFailuresSummary {
  /** True when tool failures are counted in errors / percentiles. */
  includeToolFailures: boolean;
  /** Total traces in the filtered window. */
  totalTraces: number;
  /** All errors (includes tool failures). */
  totalErrors: number;
  /** Errors excluding tool failures. */
  nonToolErrors: number;
  /** P95 latency including tool failures (ms). */
  p95Ms: number;
  /** P95 latency excluding tool failures (ms). May equal p95Ms if RPC didn't expose it. */
  p95MsNoTools: number;
}

export interface DrilldownReport {
  windowLabel: string;
  compareLabel: string;
  windowName?: string;
  scopeLabel?: string;
  generatedAt: Date;
  sections: DrilldownSection[];
  /** Absolute URL of the dashboard view at export time (so PDF links back here). */
  dashboardUrl: string;
  /** Optional snapshot of the tool-failures toggle + totals. */
  toolFailures?: ToolFailuresSummary;
}

/** Wraps a string to N chars max so long URLs/labels don't overflow the page. */
function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

export function exportDrilldownPdf(report: DrilldownReport): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Page-break helper. Re-emits the section heading on new page when needed.
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Drill-down do delta — SLO Dashboard', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  const subtitle =
    `Janela: ${report.windowLabel} · Baseline: ${report.compareLabel}` +
    (report.windowName ? ` · ${report.windowName}` : '') +
    (report.scopeLabel ? ` · Escopo: ${report.scopeLabel}` : '');
  for (const line of wrap(doc, subtitle, contentWidth)) {
    doc.text(line, margin, y);
    y += 13;
  }

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${report.generatedAt.toLocaleString('pt-BR')}`,
    margin, y,
  );
  y += 12;

  // Clickable dashboard link (full URL is preserved so the recipient can open
  // the exact same view).
  doc.setTextColor(20, 100, 200);
  const dashLines = wrap(doc, `Abrir no dashboard: ${report.dashboardUrl}`, contentWidth);
  for (const line of dashLines) {
    doc.textWithLink(line, margin, y, { url: report.dashboardUrl });
    y += 11;
  }
  doc.setTextColor(0);
  y += 8;

  // Divider
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  // ── Tool failures snapshot ──────────────────────────────────────────────
  if (report.toolFailures) {
    const tf = report.toolFailures;
    ensureSpace(110);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text('Filtro de tool failures', margin, y);
    y += 16;

    // State chip-style label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const stateLabel = tf.includeToolFailures
      ? 'Estado atual: COM tool failures (incluídos em erros e percentis)'
      : 'Estado atual: SEM tool failures (excluídos de erros e percentis)';
    if (tf.includeToolFailures) doc.setTextColor(30, 110, 180);
    else doc.setTextColor(150, 90, 20);
    doc.text(stateLabel, margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    const explain = tf.includeToolFailures
      ? 'Erros e P95 abaixo refletem todas as falhas, incluindo as originadas por chamadas a ferramentas (tool.*).'
      : 'Erros e P95 abaixo excluem falhas de ferramentas (tool.*); foram usadas as métricas non_tool_errors / p95_ms_no_tools quando disponíveis.';
    for (const line of wrap(doc, explain, contentWidth)) {
      doc.text(line, margin, y);
      y += 11;
    }
    y += 4;

    // Totals grid (two columns)
    const fmtInt = (n: number) => n.toLocaleString('pt-BR');
    const fmtMs = (n: number) => `${Math.round(n).toLocaleString('pt-BR')}ms`;
    const toolErrors = Math.max(0, tf.totalErrors - tf.nonToolErrors);
    const errorRate = tf.totalTraces > 0 ? (tf.totalErrors / tf.totalTraces) * 100 : 0;
    const errorRateNoTools = tf.totalTraces > 0 ? (tf.nonToolErrors / tf.totalTraces) * 100 : 0;

    const rows: Array<[string, string]> = [
      ['Traces na janela', fmtInt(tf.totalTraces)],
      ['Erros totais (com tools)', `${fmtInt(tf.totalErrors)} (${errorRate.toFixed(2)}%)`],
      ['Erros não-tool', `${fmtInt(tf.nonToolErrors)} (${errorRateNoTools.toFixed(2)}%)`],
      ['Tool failures isoladas', fmtInt(toolErrors)],
      ['P95 com tools', fmtMs(tf.p95Ms)],
      ['P95 sem tools', fmtMs(tf.p95MsNoTools)],
    ];

    const colWidth = contentWidth / 2;
    const rowH = 14;
    doc.setFillColor(247, 247, 250);
    const gridHeight = Math.ceil(rows.length / 2) * rowH + 8;
    ensureSpace(gridHeight + 8);
    doc.rect(margin, y - 10, contentWidth, gridHeight, 'F');

    for (let i = 0; i < rows.length; i++) {
      const [label, value] = rows[i];
      const col = i % 2;
      const rowIdx = Math.floor(i / 2);
      const cellX = margin + 8 + col * colWidth;
      const cellY = y + rowIdx * rowH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120);
      doc.text(label, cellX, cellY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(25);
      doc.text(value, cellX + colWidth - 16, cellY, { align: 'right' });
    }
    y += gridHeight + 8;
    doc.setTextColor(0);

    // Divider before sections
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  // ── Sections ────────────────────────────────────────────────────────────
  for (const section of report.sections) {
    ensureSpace(60);

    // Section heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(section.title, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`(${section.kpi})`, margin + doc.getTextWidth(section.title) + 6, y);
    y += 16;

    if (section.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(140);
      doc.setFont('helvetica', 'italic');
      doc.text(section.empty, margin, y);
      doc.setFont('helvetica', 'normal');
      y += 18;
      continue;
    }

    for (const row of section.rows) {
      // Estimate row height (label + detail + delta + link, with wrapping).
      const labelLines = wrap(doc, `#${row.rank} ${row.label}`, contentWidth - 20);
      const detailLines = wrap(doc, row.detail, contentWidth - 20);
      const linkLines = wrap(doc, row.href, contentWidth - 20);
      const rowHeight =
        labelLines.length * 13 + detailLines.length * 11 + 13 + linkLines.length * 11 + 14;
      ensureSpace(rowHeight);

      // Row background (subtle)
      doc.setFillColor(247, 247, 250);
      doc.rect(margin, y - 10, contentWidth, rowHeight - 4, 'F');

      // Label (bold, dark)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(25);
      for (const line of labelLines) {
        doc.text(line, margin + 8, y);
        y += 13;
      }

      // Detail (muted)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(95);
      for (const line of detailLines) {
        doc.text(line, margin + 8, y);
        y += 11;
      }

      // Delta (color-coded)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (row.worse) doc.setTextColor(190, 40, 50); // destructive
      else doc.setTextColor(30, 140, 80);            // emerald
      doc.text(row.deltaLabel, margin + 8, y);
      y += 13;

      // Deep-link
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(20, 100, 200);
      for (const line of linkLines) {
        doc.textWithLink(line, margin + 8, y, { url: row.href });
        y += 11;
      }

      doc.setTextColor(0);
      y += 6;
    }

    y += 6;
  }

  // ── Footer with page numbers ────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${p} de ${total} · Nexus Agents Studio`,
      pageWidth / 2, pageHeight - 18,
      { align: 'center' },
    );
  }

  const stamp = report.generatedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`slo-drilldown_${stamp}.pdf`);
}
