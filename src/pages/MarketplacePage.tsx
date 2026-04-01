import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Search, Download, Upload, Star, Eye, Tag, Filter, Package, Sparkles, Users, Shield, Zap, Brain, Code, MessageSquare } from "lucide-react";
import { toast } from "sonner";

// ═══ TYPES ═══

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  icon: string;
  version: string;
  updatedAt: string;
  featured: boolean;
  config: Record<string, unknown>;
}

// ═══ CATALOG ═══

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: Package },
  { id: 'customer_service', label: 'Atendimento', icon: MessageSquare },
  { id: 'sales', label: 'Vendas', icon: Zap },
  { id: 'data_analysis', label: 'Análise de Dados', icon: Brain },
  { id: 'development', label: 'Desenvolvimento', icon: Code },
  { id: 'security', label: 'Segurança', icon: Shield },
  { id: 'hr', label: 'RH & Pessoas', icon: Users },
];

const TEMPLATES: Template[] = [
  { id: 't1', name: 'Assistente Comercial B2B', description: 'Agente especializado em vendas B2B com CRM integration, qualificação de leads e follow-up automático', category: 'sales', author: 'Nexus Team', downloads: 2340, rating: 4.8, tags: ['CRM', 'B2B', 'Leads'], icon: '💼', version: '2.1', updatedAt: '2026-03-28', featured: true, config: { model: 'claude-sonnet-4', persona: 'sales_consultant', tools: ['crm_update', 'email_sender', 'calendar'] } },
  { id: 't2', name: 'Suporte L1 com Escalonamento', description: 'Primeiro nível de suporte com detecção de sentimento, FAQ automático e escalonamento inteligente para L2', category: 'customer_service', author: 'Nexus Team', downloads: 3120, rating: 4.9, tags: ['Suporte', 'FAQ', 'Sentiment'], icon: '🎧', version: '3.0', updatedAt: '2026-03-30', featured: true, config: { model: 'claude-sonnet-4', persona: 'support_agent', guardrails: ['pii_redaction', 'toxicity_filter'] } },
  { id: 't3', name: 'Analista de Dados SQL', description: 'Consulta bancos de dados via linguagem natural, gera relatórios e visualizações automaticamente', category: 'data_analysis', author: 'Nexus Team', downloads: 1890, rating: 4.7, tags: ['SQL', 'Relatórios', 'BI'], icon: '📊', version: '1.5', updatedAt: '2026-03-25', featured: true, config: { model: 'claude-sonnet-4', persona: 'data_analyst', tools: ['sql_query', 'chart_generator'] } },
  { id: 't4', name: 'Code Reviewer', description: 'Revisa PRs, detecta bugs, sugere melhorias e verifica padrões de código automaticamente', category: 'development', author: 'Nexus Team', downloads: 1560, rating: 4.6, tags: ['Code Review', 'CI/CD', 'GitHub'], icon: '🔍', version: '1.2', updatedAt: '2026-03-20', featured: false, config: { model: 'claude-opus-4', persona: 'code_reviewer', tools: ['github_api', 'code_executor'] } },
  { id: 't5', name: 'Compliance Officer', description: 'Verifica documentos contra regulamentações (LGPD, SOX, ISO), gera relatórios de conformidade', category: 'security', author: 'Nexus Team', downloads: 890, rating: 4.5, tags: ['LGPD', 'Compliance', 'Auditoria'], icon: '⚖️', version: '1.0', updatedAt: '2026-03-15', featured: false, config: { model: 'claude-opus-4', persona: 'compliance_officer', guardrails: ['pii_redaction', 'fact_checking'] } },
  { id: 't6', name: 'Onboarding de Colaboradores', description: 'Guia novos colaboradores nos primeiros 90 dias: documentos, treinamentos, apresentações', category: 'hr', author: 'Nexus Team', downloads: 670, rating: 4.4, tags: ['Onboarding', 'RH', 'Treinamento'], icon: '👋', version: '1.1', updatedAt: '2026-03-18', featured: false, config: { model: 'claude-sonnet-4', persona: 'hr_specialist', tools: ['calendar', 'email_sender'] } },
  { id: 't7', name: 'Prospector SDR', description: 'Pesquisa empresas, enriquece perfis, gera cold emails personalizados e agenda reuniões', category: 'sales', author: 'Community', downloads: 1230, rating: 4.3, tags: ['Outbound', 'SDR', 'Email'], icon: '🎯', version: '2.0', updatedAt: '2026-03-22', featured: false, config: { model: 'claude-sonnet-4', persona: 'sdr', tools: ['web_search', 'email_sender', 'crm_update'] } },
  { id: 't8', name: 'Assistente WhatsApp', description: 'Bot para WhatsApp Business com catálogo, pedidos, rastreamento e atendimento humanizado', category: 'customer_service', author: 'Community', downloads: 2100, rating: 4.7, tags: ['WhatsApp', 'E-commerce', 'Bot'], icon: '📱', version: '1.8', updatedAt: '2026-03-29', featured: true, config: { model: 'claude-sonnet-4', persona: 'whatsapp_assistant', tools: ['whatsapp_api', 'catalog_search'] } },
  { id: 't9', name: 'Research Agent Deep', description: 'Pesquisa profunda multi-fonte com citações, fact-checking e relatório estruturado', category: 'data_analysis', author: 'Nexus Team', downloads: 980, rating: 4.8, tags: ['Pesquisa', 'Deep Research', 'Citações'], icon: '🔬', version: '1.3', updatedAt: '2026-03-27', featured: false, config: { model: 'claude-opus-4', persona: 'researcher', tools: ['web_search', 'pdf_parser'] } },
  { id: 't10', name: 'Financial Advisor', description: 'Análise financeira com projeções, ROI, break-even e recomendações de investimento', category: 'data_analysis', author: 'Community', downloads: 540, rating: 4.2, tags: ['Financeiro', 'ROI', 'Projeções'], icon: '💰', version: '0.9', updatedAt: '2026-03-10', featured: false, config: { model: 'claude-sonnet-4', persona: 'financial_advisor', tools: ['calculator', 'chart_generator'] } },
];

// ═══ MAIN PAGE ═══

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'recent'>('downloads');
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const filtered = TEMPLATES
    .filter(t => (category === 'all' || t.category === category) && (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))))
    .sort((a, b) => sortBy === 'downloads' ? b.downloads - a.downloads : sortBy === 'rating' ? b.rating - a.rating : b.updatedAt.localeCompare(a.updatedAt));

  const installTemplate = useCallback((id: string) => {
    const template = TEMPLATES.find(t => t.id === id);
    if (!template) return;
    setInstalled(prev => new Set([...prev, id]));
    toast.success(`"${template.name}" instalado! Acesse o Agent Builder para personalizar.`);
  }, []);

  const exportTemplate = useCallback((id: string) => {
    const template = TEMPLATES.find(t => t.id === id);
    if (!template) return;
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${template.name.toLowerCase().replace(/\s/g, '-')}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Template "${template.name}" exportado`);
  }, []);

  const featuredTemplates = TEMPLATES.filter(t => t.featured);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Marketplace" description="Descubra, instale e publique templates de agentes, tools e workflows"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2"><Upload className="h-4 w-4" /> Publicar Template</Button>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Templates disponíveis', value: TEMPLATES.length, color: 'text-foreground' },
          { label: 'Downloads totais', value: `${(TEMPLATES.reduce((s, t) => s + t.downloads, 0) / 1000).toFixed(1)}K`, color: 'text-primary' },
          { label: 'Rating médio', value: `${(TEMPLATES.reduce((s, t) => s + t.rating, 0) / TEMPLATES.length).toFixed(1)}⭐`, color: 'text-amber-400' },
          { label: 'Instalados', value: installed.size, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Featured */}
      {featuredTemplates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1"><Sparkles className="h-4 w-4 text-amber-400" /> Destaques</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {featuredTemplates.map(t => (
              <div key={t.id} className="nexus-card border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{t.icon}</span>
                  <div className="flex-1 min-w-0"><h4 className="text-xs font-semibold text-foreground truncate">{t.name}</h4><p className="text-[10px] text-muted-foreground">{t.author}</p></div>
                  <span className="text-[10px] text-amber-400 font-bold">{t.rating}⭐</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">{t.description}</p>
                <Button size="sm" className="w-full text-[10px] h-7" disabled={installed.has(t.id)} onClick={() => installTemplate(t.id)}>
                  {installed.has(t.id) ? '✓ Instalado' : 'Instalar'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar templates, tags..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${category === cat.id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:bg-muted/30 border border-transparent'}`}>
              <cat.icon className="h-3 w-3" /> {cat.label}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground">
          <option value="downloads">Mais baixados</option>
          <option value="rating">Melhor avaliados</option>
          <option value="recent">Mais recentes</option>
        </select>
      </div>

      {/* Template grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(t => (
          <div key={t.id} className="nexus-card hover:ring-1 hover:ring-primary/20 transition-all">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                <p className="text-[10px] text-muted-foreground">{t.author} • v{t.version} • {t.updatedAt}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {t.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">{tag}</span>)}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {t.downloads.toLocaleString()}</span>
              <span className="text-amber-400 font-bold">{t.rating}⭐</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 text-[10px] h-7" disabled={installed.has(t.id)} onClick={() => installTemplate(t.id)}>
                {installed.has(t.id) ? '✓ Instalado' : <><Download className="h-3 w-3 mr-1" /> Instalar</>}
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => exportTemplate(t.id)}>
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="nexus-card text-center py-12">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum template encontrado</p>
        </div>
      )}
    </div>
  );
}
