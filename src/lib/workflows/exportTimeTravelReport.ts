/**
 * Export the current Time-Travel execution as a shareable report.
 *
 * Two output formats:
 *  - "markdown"  → .md file, easy to paste into Notion/GitHub/Slack
 *  - "html"      → standalone .html that auto-opens the browser print dialog
 *                  (so the user can save as PDF natively, no heavy deps)
 *
 * We deliberately avoid pulling in a PDF lib on the client; print-to-PDF
 * yields a clean, theme-neutral document and works offline.
 */

import type { WorkflowCheckpoint } from "@/services/workflowCheckpointService";

export type TimelineEntry = WorkflowCheckpoint & {
  cumulative_cost_usd: number;
  cumulative_tokens: number;
  cumulative_duration_ms: number;
};

export interface ExportInput {
  executionId: string;
  timeline: TimelineEntry[];
  /** Currently focused/inspected checkpoint (may be null). */
  activeCheckpoint: WorkflowCheckpoint | null;
  /** Inspected state JSON for the active checkpoint, if loaded. */
  activeState?: Record<string, unknown> | null;
  totals: { cost_usd: number; tokens: number; duration_ms: number };
}

// ──────── Formatting helpers (kept local to avoid coupling) ────────

function fmtDuration(ms: number): string {
  if (!ms) return "0ms";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
function fmtCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
function fmtTokens(n: number): string {
  if (n > 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
function safeJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ──────── Markdown ────────

export function buildMarkdownReport(input: ExportInput): string {
  const { executionId, timeline, activeCheckpoint, activeState, totals } = input;
  const generatedAt = new Date().toLocaleString("pt-BR");

  const lines: string[] = [];
  lines.push(`# Relatório de Execução — Time-Travel`);
  lines.push("");
  lines.push(`- **Execução:** \`${executionId}\``);
  lines.push(`- **Gerado em:** ${generatedAt}`);
  lines.push(`- **Checkpoints:** ${timeline.length}`);
  lines.push(`- **Custo total:** ${fmtCost(totals.cost_usd)}`);
  lines.push(`- **Tokens totais:** ${fmtTokens(totals.tokens)}`);
  lines.push(`- **Duração total:** ${fmtDuration(totals.duration_ms)}`);
  lines.push("");
  lines.push(`## Timeline`);
  lines.push("");
  lines.push(`| # | Node | Tipo | Status | Custo | Tokens | Duração | Erro |`);
  lines.push(`|---|------|------|--------|-------|--------|---------|------|`);
  for (const e of timeline) {
    const isActive = activeCheckpoint?.id === e.id ? " ⭐" : "";
    lines.push(
      `| ${e.step_index}${isActive} | \`${e.node_id}\` | ${e.node_type} | ${e.status} | ${fmtCost(
        e.cost_usd,
      )} | ${fmtTokens(e.tokens_used)} | ${fmtDuration(e.duration_ms)} | ${
        e.error ? e.error.replace(/\|/g, "\\|") : "—"
      } |`,
    );
  }
  lines.push("");

  if (activeCheckpoint) {
    lines.push(`## Step ativo — #${activeCheckpoint.step_index} (${activeCheckpoint.node_type})`);
    lines.push("");
    lines.push(`- **Node ID:** \`${activeCheckpoint.node_id}\``);
    lines.push(`- **Status:** ${activeCheckpoint.status}`);
    lines.push(`- **Custo:** ${fmtCost(activeCheckpoint.cost_usd)}`);
    lines.push(`- **Tokens:** ${fmtTokens(activeCheckpoint.tokens_used)}`);
    lines.push(`- **Duração:** ${fmtDuration(activeCheckpoint.duration_ms)}`);
    lines.push(`- **Criado em:** ${new Date(activeCheckpoint.created_at).toLocaleString("pt-BR")}`);
    if (activeCheckpoint.error) {
      lines.push(`- **Erro:** ${activeCheckpoint.error}`);
    }
    lines.push("");
    lines.push(`### Input`);
    lines.push("```json");
    lines.push(safeJson(activeCheckpoint.node_input));
    lines.push("```");
    lines.push("");
    lines.push(`### Output`);
    lines.push("```json");
    lines.push(safeJson(activeCheckpoint.node_output));
    lines.push("```");
    lines.push("");
    if (activeState) {
      lines.push(`### Estado completo`);
      lines.push("```json");
      lines.push(safeJson(activeState));
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ──────── HTML (print-to-PDF) ────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildHtmlReport(input: ExportInput): string {
  const { executionId, timeline, activeCheckpoint, activeState, totals } = input;
  const generatedAt = new Date().toLocaleString("pt-BR");

  const rows = timeline
    .map((e) => {
      const isActive = activeCheckpoint?.id === e.id;
      const statusColor =
        e.status === "completed"
          ? "#10b981"
          : e.status === "failed"
          ? "#ef4444"
          : e.status === "running"
          ? "#3b82f6"
          : "#94a3b8";
      return `
        <tr class="${isActive ? "active" : ""}">
          <td class="num">#${e.step_index}${isActive ? " ⭐" : ""}</td>
          <td><code>${escapeHtml(e.node_id)}</code></td>
          <td>${escapeHtml(e.node_type)}</td>
          <td><span class="status" style="color:${statusColor};border-color:${statusColor}">${escapeHtml(e.status)}</span></td>
          <td class="num">${fmtCost(e.cost_usd)}</td>
          <td class="num">${fmtTokens(e.tokens_used)}</td>
          <td class="num">${fmtDuration(e.duration_ms)}</td>
          <td class="err">${e.error ? escapeHtml(e.error) : "—"}</td>
        </tr>`;
    })
    .join("");

  const activeBlock = activeCheckpoint
    ? `
      <section class="active-step">
        <h2>Step ativo — #${activeCheckpoint.step_index} (${escapeHtml(activeCheckpoint.node_type)})</h2>
        <dl>
          <dt>Node ID</dt><dd><code>${escapeHtml(activeCheckpoint.node_id)}</code></dd>
          <dt>Status</dt><dd>${escapeHtml(activeCheckpoint.status)}</dd>
          <dt>Custo</dt><dd>${fmtCost(activeCheckpoint.cost_usd)}</dd>
          <dt>Tokens</dt><dd>${fmtTokens(activeCheckpoint.tokens_used)}</dd>
          <dt>Duração</dt><dd>${fmtDuration(activeCheckpoint.duration_ms)}</dd>
          <dt>Criado em</dt><dd>${new Date(activeCheckpoint.created_at).toLocaleString("pt-BR")}</dd>
          ${activeCheckpoint.error ? `<dt>Erro</dt><dd class="err">${escapeHtml(activeCheckpoint.error)}</dd>` : ""}
        </dl>
        <h3>Input</h3>
        <pre><code>${escapeHtml(safeJson(activeCheckpoint.node_input))}</code></pre>
        <h3>Output</h3>
        <pre><code>${escapeHtml(safeJson(activeCheckpoint.node_output))}</code></pre>
        ${
          activeState
            ? `<h3>Estado completo</h3><pre><code>${escapeHtml(safeJson(activeState))}</code></pre>`
            : ""
        }
      </section>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de Execução — ${escapeHtml(executionId)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; margin: 32px; color: #0f172a; background: #fff; line-height: 1.5; }
  header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  h3 { font-size: 13px; margin-top: 18px; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; font-size: 12px; color: #475569; }
  .meta b { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.err { color: #b91c1c; }
  tr.active { background: #fef3c7; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; max-height: 400px; }
  .status { display: inline-block; padding: 1px 6px; border: 1px solid; border-radius: 4px; font-size: 10px; text-transform: uppercase; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; font-size: 12px; margin: 8px 0 16px; }
  dt { color: #64748b; }
  dd { margin: 0; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  @media print {
    body { margin: 0; }
    pre { max-height: none; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <header>
    <h1>Relatório de Execução — Time-Travel</h1>
    <div class="meta">
      <div><b>Execução:</b> <code>${escapeHtml(executionId)}</code></div>
      <div><b>Gerado em:</b> ${escapeHtml(generatedAt)}</div>
      <div><b>Checkpoints:</b> ${timeline.length}</div>
      <div><b>Custo total:</b> ${fmtCost(totals.cost_usd)}</div>
      <div><b>Tokens totais:</b> ${fmtTokens(totals.tokens)}</div>
      <div><b>Duração total:</b> ${fmtDuration(totals.duration_ms)}</div>
    </div>
  </header>

  <section>
    <h2>Timeline</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Node</th><th>Tipo</th><th>Status</th><th>Custo</th><th>Tokens</th><th>Duração</th><th>Erro</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  ${activeBlock}

  <footer>
    Gerado pelo Nexus Agents Studio · Use Ctrl/Cmd+P para salvar como PDF.
  </footer>

  <script>
    // Auto-open print dialog so the user can save as PDF immediately.
    window.addEventListener('load', () => setTimeout(() => window.print(), 300));
  </script>
</body>
</html>`;
}

// ──────── Trigger downloads / print ────────

export function downloadMarkdown(input: ExportInput) {
  const md = buildMarkdownReport(input);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `execucao_${input.executionId.slice(0, 8)}_${Date.now()}.md`);
}

export function openPrintablePdf(input: ExportInput) {
  const html = buildHtmlReport(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  // Open in a new tab; the embedded script triggers print() automatically.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Pop-up blocked → fall back to direct download of the HTML so the user can open manually.
    triggerDownload(blob, `execucao_${input.executionId.slice(0, 8)}_${Date.now()}.html`);
  }
  // Revoke after a delay so the new tab has time to load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
