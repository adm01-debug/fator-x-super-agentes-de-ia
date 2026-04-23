/**
 * ShareTimelineState — resumo compartilhável do estado atual da timeline.
 *
 * Renderiza um cartão com:
 *   - chips do que está selecionado (versão atual, sel, A, B, modo, preset)
 *   - link curto (URL atual com todos os params preservados)
 *   - bloco de markdown pronto para colar no Slack/e-mail/issue tracker
 *
 * Não muda a URL — só lê do estado atual e copia. O link gerado é exatamente
 * a URL ativa, então abrir em outra aba reproduz a mesma visão.
 */
import { useMemo, useState } from 'react';
import { Link2, Copy, Check, Share2, Eye, GitCompare, Filter, Tag, Activity } from 'lucide-react';
import type { AgentVersion } from '@/services/agentsService';
import { toast } from 'sonner';

interface Props {
  agentName: string;
  selected: AgentVersion | null;
  versionA: AgentVersion | null;
  versionB: AgentVersion | null;
  mode: 'detail' | 'compare';
  presetLabel: string;
  rangeLabel?: string;
  /** Tags ativas no filtro multi-tag por tipo de evento (vazio = sem filtro). */
  typesLabels?: string[];
  /** session_id da execução fixada via ?run=, se houver. */
  runId?: string | null;
}

function shortVer(v: AgentVersion | null): string {
  if (!v) return '—';
  return `v${v.version}${v.model ? ` · ${v.model}` : ''}`;
}

export function ShareTimelineState({
  agentName, selected, versionA, versionB, mode, presetLabel, rangeLabel,
  typesLabels, runId,
}: Props) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const hasTypes = !!typesLabels && typesLabels.length > 0;
  // Encurta o session_id no resumo: cabeçalho legível + id completo entre
  // parênteses para que o leitor consiga buscar nos logs também.
  const runShort = runId ? runId.slice(-8) : null;

  const markdown = useMemo(() => {
    const lines: string[] = [];
    lines.push(`### 🕓 Timeline — ${agentName}`);
    lines.push('');
    lines.push(`**Modo:** ${mode === 'compare' ? '🔀 Comparação A ↔ B' : '👁 Detalhe'}`);
    if (selected) lines.push(`**Selecionada:** ${shortVer(selected)}`);
    if (mode === 'compare' && versionA && versionB) {
      lines.push(`**A:** ${shortVer(versionA)}`);
      lines.push(`**B:** ${shortVer(versionB)}`);
    }
    if (presetLabel && presetLabel !== 'Todas') {
      lines.push(`**Filtro:** ${presetLabel}`);
    }
    if (hasTypes) {
      lines.push(`**Tipos:** ${typesLabels!.join(', ')}`);
    }
    if (runId) {
      lines.push(`**Execução:** \`${runId}\``);
    }
    if (rangeLabel) {
      lines.push(`**Intervalo:** ${rangeLabel}`);
    }
    lines.push('');
    lines.push(`🔗 ${url}`);
    return lines.join('\n');
  }, [agentName, selected, versionA, versionB, mode, presetLabel, rangeLabel, typesLabels, hasTypes, runId, url]);

  const handleCopy = async (text: string, kind: 'link' | 'md') => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === 'link') {
        setCopiedLink(true);
        toast.success('Link copiado');
        window.setTimeout(() => setCopiedLink(false), 1600);
      } else {
        setCopiedMd(true);
        toast.success('Resumo + link copiados');
        window.setTimeout(() => setCopiedMd(false), 1600);
      }
    } catch {
      toast.error('Não foi possível copiar — tente selecionar e copiar manualmente');
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/50">
        <Share2 className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="text-xs font-semibold text-foreground">Compartilhar visão atual</span>
      </div>

      {/* Chips do estado */}
      <div className="px-3 pt-2.5 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-primary/40 bg-primary/10 text-primary">
          {mode === 'compare'
            ? <><GitCompare className="h-2.5 w-2.5" /> Comparação</>
            : <><Eye className="h-2.5 w-2.5" /> Detalhe</>}
        </span>
        {selected && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono border border-border/60 bg-secondary/60 text-foreground">
            sel: v{selected.version}
          </span>
        )}
        {mode === 'compare' && versionA && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono border border-destructive/40 bg-destructive/10 text-destructive">
            A: v{versionA.version}
          </span>
        )}
        {mode === 'compare' && versionB && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono border border-nexus-emerald/40 bg-nexus-emerald/10 text-nexus-emerald">
            B: v{versionB.version}
          </span>
        )}
        {presetLabel && presetLabel !== 'Todas' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border border-border/60 bg-secondary/60 text-muted-foreground">
            <Filter className="h-2.5 w-2.5" /> {presetLabel}
          </span>
        )}
        {rangeLabel && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border border-border/60 bg-secondary/60 text-muted-foreground">
            {rangeLabel}
          </span>
        )}
      </div>

      {/* Link */}
      <div className="px-3 py-2 flex items-center gap-2">
        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
        <code className="flex-1 min-w-0 truncate text-[10px] font-mono text-muted-foreground bg-background/40 border border-border/40 rounded px-1.5 py-1">
          {url}
        </code>
        <button
          type="button"
          onClick={() => handleCopy(url, 'link')}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors shrink-0 ${
            copiedLink
              ? 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/40'
              : 'bg-secondary/60 text-foreground border-border/60 hover:bg-secondary'
          }`}
          title="Copiar apenas o link"
        >
          {copiedLink ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
          {copiedLink ? 'Copiado' : 'Link'}
        </button>
      </div>

      {/* Markdown preview + copiar */}
      <div className="px-3 pb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Resumo (markdown)
          </span>
          <button
            type="button"
            onClick={() => handleCopy(markdown, 'md')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
              copiedMd
                ? 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/40'
                : 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
            }`}
            title="Copia o resumo formatado em markdown com o link no final"
          >
            {copiedMd ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
            {copiedMd ? 'Copiado' : 'Copiar resumo'}
          </button>
        </div>
        <textarea
          readOnly
          value={markdown}
          className="w-full h-32 p-2 text-[10px] font-mono bg-background/40 text-foreground border border-border/40 rounded resize-y focus:outline-none focus:border-primary/40"
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Resumo da visão atual em markdown"
        />
      </div>
    </div>
  );
}
