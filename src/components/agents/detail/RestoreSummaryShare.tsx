/**
 * RestoreSummaryShare — gera um resumo em Markdown pronto para colar
 * no Slack/Email/Notion antes de confirmar um rollback. Inclui:
 *   - cabeçalho com versões e quem está restaurando
 *   - tabela antes/depois dos campos selecionados
 *   - top N mudanças por impacto (com critérios resumidos)
 *   - score agregado e contagem de erros/avisos de validação (se houver)
 *
 * O texto é puramente derivado das props — sem efeitos colaterais —, então
 * é seguro re-renderizar a cada keystroke e copiar a qualquer momento.
 */
import { useMemo, useState } from 'react';
import { Copy, Check, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import type { AgentVersion } from '@/services/agentsService';
import type { RestoreDiff, FieldChange } from './restoreDiffHelpers';
import type { RestoreValidation } from './restoreValidation';

interface Props {
  agentName: string;
  current: AgentVersion | null | undefined;
  source: AgentVersion;
  nextVersion: number;
  diff: RestoreDiff;
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean };
  validation?: RestoreValidation | null;
}

const RISK_EMOJI: Record<FieldChange['risk'], string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const KIND_LABEL: Record<FieldChange['kind'], string> = {
  added: '➕ Adicionado',
  removed: '➖ Removido',
  modified: '✏️ Alterado',
};

function trunc(v: unknown, max = 80): string {
  if (v === null || v === undefined || v === '') return '_(vazio)_';
  const s = typeof v === 'string' ? v : Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v);
  const oneLine = s.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

function buildMarkdown({
  agentName, current, source, nextVersion, diff, options, validation,
}: Props): string {
  const lines: string[] = [];
  const date = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const fields: string[] = [];
  if (options.copyPrompt) fields.push('prompt');
  if (options.copyTools) fields.push('tools');
  if (options.copyModel) fields.push('modelo/parâmetros');

  lines.push(`### 🔄 Rollback proposto — ${agentName}`);
  lines.push('');
  lines.push(`> **De:** v${current?.version ?? '?'} → **Aplicar v${source.version}** _(criará v${nextVersion})_`);
  lines.push(`> **Quando:** ${date}`);
  lines.push(`> **Campos:** ${fields.join(', ') || '_(nenhum)_'}`);
  lines.push('');

  // Sumário de risco agregado
  const totalChanges = diff.changes.length;
  lines.push(`**Resumo:** ${totalChanges} alteração(ões) · risco agregado **${diff.overallRisk.toUpperCase()}** (${diff.overallImpact}/100)`);
  if (diff.toolsAdded.length || diff.toolsRemoved.length) {
    const parts: string[] = [];
    if (diff.toolsAdded.length) parts.push(`+${diff.toolsAdded.length} tool(s)`);
    if (diff.toolsRemoved.length) parts.push(`−${diff.toolsRemoved.length} tool(s)`);
    lines.push(`**Tools:** ${parts.join(' · ')}`);
  }
  if (diff.promptDeltaChars !== 0) {
    lines.push(`**Prompt:** ${diff.promptDeltaChars > 0 ? '+' : ''}${diff.promptDeltaChars} chars`);
  }
  lines.push('');

  // Validação
  if (validation && (validation.errors.length || validation.warnings.length)) {
    lines.push('**⚠️ Validação:**');
    validation.errors.forEach((e) => lines.push(`- ❌ ${e.message}`));
    validation.warnings.forEach((w) => lines.push(`- ⚠️ ${w.message}`));
    lines.push('');
  }

  // Top riscos (até 5)
  const topRisks = [...diff.changes].sort((a, b) => b.impact - a.impact).slice(0, 5);
  if (topRisks.length > 0) {
    lines.push('### 🎯 Top mudanças por impacto');
    lines.push('');
    topRisks.forEach((c, idx) => {
      lines.push(`${idx + 1}. ${RISK_EMOJI[c.risk]} **${c.label}** — ${c.reason} _(impacto ${c.impact}/100)_`);
      // Critérios resumidos (até 3)
      c.criteria.slice(0, 3).forEach((cr) => {
        const sign = cr.points >= 0 ? '+' : '';
        lines.push(`   - \`${sign}${cr.points}\` ${cr.label}${cr.detail ? ` — ${cr.detail}` : ''}`);
      });
    });
    lines.push('');
  }

  // Antes/depois — tabela compacta
  lines.push('### 📋 Antes/Depois');
  lines.push('');
  lines.push('| Campo | Antes | Depois |');
  lines.push('|-------|-------|--------|');
  diff.changes.forEach((c) => {
    if (c.field === 'tools') {
      const beforeT = diff.toolsRemoved.length ? `−${diff.toolsRemoved.join(', ')}` : '_(nenhuma removida)_';
      const afterT = diff.toolsAdded.length ? `+${diff.toolsAdded.join(', ')}` : '_(nenhuma adicionada)_';
      lines.push(`| ${KIND_LABEL[c.kind]} **${c.label}** | ${beforeT} | ${afterT} |`);
    } else {
      lines.push(`| ${KIND_LABEL[c.kind]} **${c.label}** | ${trunc(c.before)} | ${trunc(c.after)} |`);
    }
  });
  lines.push('');
  lines.push('_Rollback não destrutivo — a versão atual é preservada no histórico._');

  return lines.join('\n');
}

export function RestoreSummaryShare(props: Props) {
  const markdown = useMemo(() => buildMarkdown(props), [props]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback silencioso — alguns browsers exigem HTTPS para a API.
      // Usuário ainda pode copiar manualmente do <textarea> expandido.
      setExpanded(true);
    }
  };

  const lineCount = markdown.split('\n').length;
  const charCount = markdown.length;

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">Resumo para o time</span>
          <span className="text-[10px] text-muted-foreground">
            {lineCount} linhas · {charCount} chars
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            aria-expanded={expanded}
            title={expanded ? 'Recolher preview' : 'Expandir preview do markdown'}
          >
            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {expanded ? 'Recolher' : 'Pré-visualizar'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
              copied
                ? 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/40'
                : 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
            }`}
            title="Copiar markdown para a área de transferência"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado!' : 'Copiar resumo'}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        Cole no Slack, Notion ou e-mail para alinhar com o time antes de confirmar.
        Inclui antes/depois, top 5 riscos com critérios e validações pendentes.
      </div>

      {expanded && (
        <div className="border-t border-border/50">
          <textarea
            readOnly
            value={markdown}
            className="w-full h-64 p-3 text-[11px] font-mono bg-background/40 text-foreground border-0 focus:outline-none resize-y"
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Markdown do resumo do rollback"
          />
        </div>
      )}
    </div>
  );
}
