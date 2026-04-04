import { Badge } from "@/components/ui/badge";

const knowledgeAreas = [
  { icon: '📋', title: 'Processos & SOPs', desc: 'Procedimentos operacionais padrão da empresa', domain: 'processos' },
  { icon: '📊', title: 'Relatórios & Dados', desc: 'Relatórios financeiros, KPIs e dashboards', domain: 'dados' },
  { icon: '👥', title: 'RH & Pessoas', desc: 'Políticas de RH, benefícios e cultura', domain: 'rh' },
  { icon: '💰', title: 'Financeiro', desc: 'Orçamentos, projeções e fluxo de caixa', domain: 'financeiro' },
  { icon: '🏭', title: 'Fornecedores', desc: 'Catálogo, preços e avaliações de fornecedores', domain: 'compras' },
  { icon: '🛒', title: 'Produtos & Catálogo', desc: 'Produtos, especificações e preços', domain: 'produtos' },
  { icon: '📞', title: 'Clientes & CRM', desc: 'Base de clientes, histórico e segmentação', domain: 'comercial' },
  { icon: '⚖️', title: 'Jurídico & Compliance', desc: 'Contratos, termos e regulamentações', domain: 'juridico' },
];

export function KnowledgeAreasTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {knowledgeAreas.map(area => (
        <div key={area.title} className="nexus-card cursor-pointer hover:border-primary/30 transition-colors">
          <div className="text-3xl mb-3">{area.icon}</div>
          <h3 className="text-sm font-semibold text-foreground">{area.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-1 mb-3">{area.desc}</p>
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <Badge variant="outline" className="text-[11px]">{area.domain}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
