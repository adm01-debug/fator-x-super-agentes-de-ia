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

export interface DrilldownReport {
  windowLabel: string;
  compareLabel: string;
  windowName?: string;
  scopeLabel?: string;
  generatedAt: Date;
  sections: DrilldownSection[];
  /** Absolute URL of the dashboard view at export time (so PDF links back here). */
  dashboardUrl: string;
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
