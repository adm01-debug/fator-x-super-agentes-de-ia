/**
 * Skills Marketplace — Browse, search, and install agent skills
 * Connects to skill_registry table via skillsRegistryService
 */
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { InfoHint } from '@/components/shared/InfoHint';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Download, Star, CheckCircle2, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listSkills, type AgentSkillDefinition } from '@/services/skillsRegistryService';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'tools', label: 'Ferramentas' },
  { value: 'knowledge', label: 'Conhecimento' },
  { value: 'prompts', label: 'Prompts' },
  { value: 'workflows', label: 'Workflows' },
  { value: 'integrations', label: 'Integrações' },
];

const CATEGORY_COLORS: Record<string, string> = {
  tools: 'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20',
  knowledge: 'bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/20',
  prompts: 'bg-nexus-purple/10 text-nexus-purple border-nexus-purple/20',
  workflows: 'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20',
  integrations: 'bg-primary/10 text-primary border-primary/20',
};

export default function SkillsMarketplacePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['skills_marketplace', search, category],
    queryFn: () => listSkills({
      search: search || undefined,
      category: category === 'all' ? undefined : category,
      limit: 50,
    }),
  });

  const skills = data?.skills ?? [];

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Skills Marketplace"
        description="Descubra e instale habilidades para potencializar seus agentes"
      />

      <InfoHint title="O que são Skills?">
        Skills são pacotes de capacidades que podem ser instalados em agentes — ferramentas, prompts, bases de conhecimento, workflows e integrações prontos para uso.
      </InfoHint>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px] bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={9} cols={3} />
      ) : skills.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhuma skill encontrada"
          description="Tente outro termo de busca ou categoria."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {data && data.total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {skills.length} de {data.total} skills
        </p>
      )}
    </div>
  );
}

function SkillCard({ skill }: { skill: AgentSkillDefinition }) {
  const colorClass = CATEGORY_COLORS[skill.category] || 'bg-muted text-muted-foreground';

  return (
    <div className="nexus-card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground truncate">{skill.name}</h3>
            {skill.is_verified && (
              <Shield className="h-3.5 w-3.5 text-nexus-emerald shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`text-[10px] ${colorClass}`}>
          {skill.category}
        </Badge>
        <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
        <span className="text-[10px] text-muted-foreground">por {skill.author}</span>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" /> {skill.install_count}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" /> {skill.rating.toFixed(1)}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => toast.info(`Selecione um agente para instalar "${skill.name}"`)}
        >
          <CheckCircle2 className="h-3 w-3" /> Instalar
        </Button>
      </div>

      {skill.tags && skill.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {skill.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
