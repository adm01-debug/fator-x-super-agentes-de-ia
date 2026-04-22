/**
 * Agents Docs Page — `/docs/agents`
 *
 * Índice operacional dos 7 agentes enriquecidos de Vendas da Promo Brindes.
 * Gerado a partir da fonte única de verdade em:
 *   - `src/data/agentTemplates.ts` (prompts, tools, guardrails, HITL, etc.)
 *   - `src/data/toolCatalog.ts`    (resolução de cada tool_id para edge fn/MCP)
 *   - `src/data/knowledgeBaseSeeds.ts` (KBs consumidas por agente)
 *
 * Objetivo: dar ao time comercial/gestão um "mapa rápido" do que cada
 * agente faz, que tools usa, de que KBs depende, em que canais está
 * publicado e quando aciona human-in-the-loop.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Rocket, FileText, ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AGENT_TEMPLATES } from '@/data/agentTemplates';
import { resolveTool } from '@/data/toolCatalog';
import { getKnowledgeBaseIdsForAgent, getKnowledgeBaseSeed } from '@/data/knowledgeBaseSeeds';

const ENRICHED_IDS = [
  'customer_support',
  'lead_qualifier',
  'quote_generator',
  'sales_assistant',
  'spec_vendas_sdr',
  'spec_vendas_closer',
  'spec_vendas_intel',
] as const;

export default function AgentsDocsPage() {
  const navigate = useNavigate();

  const docs = useMemo(() => {
    return ENRICHED_IDS.flatMap((id) => {
      const t = AGENT_TEMPLATES.find((x) => x.id === id);
      if (!t) return [];
      const tools = (t.config.tools ?? [])
        .map((toolId) => {
          const def = resolveTool(toolId);
          return def ? { id: toolId, name: def.name, category: def.category } : null;
        })
        .filter((x): x is { id: string; name: string; category: string } => x !== null);
      const kbIds = getKnowledgeBaseIdsForAgent(id);
      const kbs = kbIds.map((kbId) => {
        const seed = getKnowledgeBaseSeed(kbId);
        return { id: kbId, name: seed?.name ?? kbId, icon: seed?.icon ?? '📚' };
      });
      return [{ template: t, tools, kbs }];
    });
  }, []);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Documentação dos Agentes"
        description="Mapa operacional dos 7 agentes de Vendas — o que cada um faz, que tools usa, de que Knowledge Bases depende e quando aciona aprovação humana."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/agents')}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        }
      />

      <div className="grid gap-4">
        {docs.map(({ template: t, tools, kbs }) => (
          <Card key={t.id} className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                  {t.emoji}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-heading font-bold text-foreground">{t.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Badge variant="outline" className="text-[11px]">
                  {t.config.model}
                </Badge>
                {t.config.reasoning && (
                  <Badge variant="secondary" className="text-[11px]">
                    {t.config.reasoning}
                  </Badge>
                )}
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => navigate(`/agents/templates?forkAgent=${t.id}`)}
                >
                  <Rocket className="h-3.5 w-3.5" /> Forkar
                </Button>
              </div>
            </div>

            {/* Grid: Tools | KBs | HITL */}
            <div className="grid md:grid-cols-3 gap-4 pt-2 border-t border-border/40">
              {/* Tools */}
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-1.5">
                  Ferramentas ({tools.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {tools.map((tool) => (
                    <Badge
                      key={tool.id}
                      variant="outline"
                      className={`text-[11px] ${
                        tool.category === 'action'
                          ? 'border-nexus-amber/40 text-nexus-amber'
                          : tool.category === 'data'
                            ? 'border-primary/40 text-primary'
                            : tool.category === 'compute'
                              ? 'border-nexus-emerald/40 text-nexus-emerald'
                              : 'border-nexus-purple/40 text-nexus-purple'
                      }`}
                    >
                      {tool.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* KBs */}
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-1.5">
                  Knowledge Bases ({kbs.length})
                </p>
                <div className="space-y-1">
                  {kbs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Nenhuma KB conectada</p>
                  ) : (
                    kbs.map((kb) => (
                      <div key={kb.id} className="flex items-center gap-1.5 text-[11px]">
                        <span>{kb.icon}</span>
                        <span className="text-foreground">{kb.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* HITL */}
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-1.5">
                  Escalação humana (HITL)
                </p>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {(t.config.human_in_loop_triggers ?? []).length === 0 ? (
                    <li className="italic">Nenhuma regra de HITL configurada</li>
                  ) : (
                    (t.config.human_in_loop_triggers ?? []).map((trigger) => (
                      <li key={trigger} className="flex items-start gap-1.5">
                        <span className="text-nexus-amber shrink-0">•</span>
                        <span>{trigger}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {/* Deploy channels + budget (rodapé) */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border/40 text-[11px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Canais:</span>
                {(t.config.deploy_channels ?? []).map((dc) => (
                  <Badge key={dc.channel} variant="outline" className="text-[11px]">
                    {dc.channel}
                  </Badge>
                ))}
              </div>
              {t.config.monthly_budget && (
                <div className="text-muted-foreground">
                  Budget:{' '}
                  <strong className="text-foreground">US$ {t.config.monthly_budget}/mês</strong>
                  {' · '}alerta em <strong>{t.config.budget_alert_threshold ?? 80}%</strong>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Setup das Knowledge Bases</p>
            <p className="text-[11px] text-muted-foreground">
              Antes de ativar em produção, confirme que cada KB tem seus docs essenciais ingeridos.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => navigate('/knowledge-bases/setup')}
        >
          Abrir setup <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Card>
    </div>
  );
}
