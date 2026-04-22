/**
 * Knowledge Base Setup Page — `/knowledge-bases/setup`
 *
 * Fecha o loop aberto por `src/data/knowledgeBaseSeeds.ts`:
 * mostra ao admin cada KB canônica esperada pelos 7 agentes de Vendas,
 * junto com:
 *  - os docs essenciais que precisam ser subidos;
 *  - quais agentes param de operar bem sem essa KB;
 *  - status de ingestão (live vs. seed) confrontando o que existe no DB
 *    (`public.knowledge_bases`) com o que o código declara.
 *
 * Não ingere docs sozinha — aponta para a página `/knowledge` onde o
 * admin faz a ingestão via upload + edge function `rag-ingest`.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, Circle, FileUp, ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listKnowledgeBases } from '@/services/knowledgeService';
import { KNOWLEDGE_BASE_SEEDS, type KnowledgeBaseSeed } from '@/data/knowledgeBaseSeeds';
import { AGENT_TEMPLATES } from '@/data/agentTemplates';

type SetupStatus = 'live' | 'seed_only' | 'partial';

interface SeedWithStatus extends KnowledgeBaseSeed {
  status: SetupStatus;
  liveDocCount: number;
  agentLabels: string[];
}

export default function KnowledgeBaseSetupPage() {
  const navigate = useNavigate();

  const { data: liveKbs = [], isLoading } = useQuery({
    queryKey: ['knowledge_bases_setup'],
    queryFn: listKnowledgeBases,
  });

  const seeds = useMemo<SeedWithStatus[]>(() => {
    return KNOWLEDGE_BASE_SEEDS.map((seed) => {
      const live = liveKbs.find((kb) => kb.id === seed.id || kb.name === seed.name);
      const liveDocCount = Number(live?.document_count ?? 0);
      const status: SetupStatus = !live ? 'seed_only' : liveDocCount === 0 ? 'partial' : 'live';
      const agentLabels = seed.intended_agents.map((id) => {
        const t = AGENT_TEMPLATES.find((x) => x.id === id);
        return t ? `${t.emoji} ${t.name}` : id;
      });
      return { ...seed, status, liveDocCount, agentLabels };
    });
  }, [liveKbs]);

  const counts = useMemo(
    () => ({
      total: seeds.length,
      live: seeds.filter((s) => s.status === 'live').length,
      partial: seeds.filter((s) => s.status === 'partial').length,
      missing: seeds.filter((s) => s.status === 'seed_only').length,
    }),
    [seeds],
  );

  const readinessPct = seeds.length > 0 ? Math.round((counts.live / seeds.length) * 100) : 0;

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Knowledge Bases — Setup"
        description="Bases de conhecimento esperadas pelos agentes de Vendas da Promo Brindes."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/knowledge')}
          >
            <FileUp className="h-3.5 w-3.5" /> Ir para ingestão
          </Button>
        }
      />

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total de KBs esperadas"
          value={counts.total}
          icon={<Circle className="h-4 w-4" />}
        />
        <StatCard
          label="Live (com documentos)"
          value={counts.live}
          icon={<CheckCircle2 className="h-4 w-4 text-nexus-emerald" />}
        />
        <StatCard
          label="Parciais (vazias no DB)"
          value={counts.partial}
          icon={<AlertTriangle className="h-4 w-4 text-nexus-amber" />}
        />
        <StatCard
          label="Readiness"
          value={`${readinessPct}%`}
          icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando status das KBs…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {seeds.map((s) => (
            <KbSeedCard key={s.id} seed={s} onOpen={() => navigate('/knowledge')} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="nexus-card text-center py-3">
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}</div>
      <p className="text-xl font-heading font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function KbSeedCard({ seed, onOpen }: { seed: SeedWithStatus; onOpen: () => void }) {
  const statusBadge = {
    live: (
      <Badge className="bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/30 text-[11px]">
        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Ativa — {seed.liveDocCount} docs
      </Badge>
    ),
    partial: (
      <Badge className="bg-nexus-amber/10 text-nexus-amber border-nexus-amber/30 text-[11px]">
        <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Criada, sem docs
      </Badge>
    ),
    seed_only: (
      <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[11px]">
        <Circle className="h-2.5 w-2.5 mr-1" /> Pendente no DB
      </Badge>
    ),
  }[seed.status];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{seed.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{seed.name}</h3>
            <p className="text-[11px] text-muted-foreground font-mono truncate">{seed.id}</p>
          </div>
        </div>
        {statusBadge}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{seed.description}</p>

      <div>
        <p className="text-[11px] font-semibold text-foreground mb-1">
          Agentes que consomem ({seed.agentLabels.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {seed.agentLabels.map((label) => (
            <Badge key={label} variant="outline" className="text-[11px]">
              {label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-foreground mb-1.5">
          Docs esperados ({seed.suggested_docs.filter((d) => d.essential).length} essenciais)
        </p>
        <ul className="space-y-1.5">
          {seed.suggested_docs.map((doc) => (
            <li key={doc.category} className="flex items-start gap-2 text-[11px]">
              {doc.essential ? (
                <Circle
                  className="h-3 w-3 shrink-0 mt-0.5 text-destructive"
                  aria-label="essential"
                />
              ) : (
                <Circle className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/40" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground">{doc.category}</p>
                <p className="text-muted-foreground">{doc.description}</p>
                <div className="flex gap-1 mt-0.5">
                  {doc.types.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={onOpen}>
        <FileUp className="h-3.5 w-3.5" /> Ingerir documentos
        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
      </Button>
    </Card>
  );
}
