/**
 * Marketplace Monetizado — Revenue Share real
 * Lê skill_registry (DB externo) + skill_marketplace_meta/purchases/reviews (Cloud).
 */
import { useState, useMemo } from 'react';
import { Store, DollarSign, TrendingUp, Star, Download, Upload, BarChart3, Wallet, Shield, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { InfoHint } from '@/components/shared/InfoHint';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listSkills, getSkill, purchaseSkill, listReviews, submitReview,
  getMyPurchases, getCreatorEarnings, getCreatorSales, formatPrice,
  type MarketplaceSkill, type ListSkillsFilters,
} from '@/services/marketplaceService';

export default function MarketplaceMonetizedPage() {
  const [tab, setTab] = useState('browse');
  const [filters, setFilters] = useState<ListSkillsFilters>({ pricing: 'all', sort: 'popular' });
  const [search, setSearch] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['mkt-skills', filters, search],
    queryFn: () => listSkills({ ...filters, search: search || undefined }),
  });

  const { data: earnings } = useQuery({ queryKey: ['mkt-earnings'], queryFn: getCreatorEarnings });
  const { data: purchases = [] } = useQuery({ queryKey: ['mkt-purchases'], queryFn: getMyPurchases });
  const { data: sales = [] } = useQuery({ queryKey: ['mkt-sales'], queryFn: getCreatorSales });

  const totalInstalls = useMemo(() => skills.reduce((s, k) => s + k.install_count, 0), [skills]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Marketplace Monetizado"
        description="Publique skills e agentes — receba 70% de revenue share. Free, one-time ou subscription."
      />

      <InfoHint title="Como funciona">
        Criadores recebem <strong>70%</strong> de cada venda, plataforma fica com <strong>30%</strong>. Pagamento mock nesta versão — Stripe Connect na próxima iteração.
      </InfoHint>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Receita marketplace" value={formatPrice((earnings?.total_revenue_cents ?? 0) + 0)} />
        <StatCard icon={Wallet} label="Seus ganhos" value={formatPrice(earnings?.total_payout_cents ?? 0)} accent />
        <StatCard icon={Download} label="Total instalações" value={totalInstalls.toLocaleString('pt-BR')} />
        <StatCard icon={TrendingUp} label="Revenue share" value="70 / 30" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse"><Store className="h-3.5 w-3.5 mr-1.5" />Marketplace</TabsTrigger>
          <TabsTrigger value="purchases"><Download className="h-3.5 w-3.5 mr-1.5" />Minhas compras</TabsTrigger>
          <TabsTrigger value="creator"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Modo Creator</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50" />
            </div>
            <Select value={filters.category ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
              <SelectTrigger className="w-[150px] bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                <SelectItem value="tools">Ferramentas</SelectItem>
                <SelectItem value="knowledge">Conhecimento</SelectItem>
                <SelectItem value="prompts">Prompts</SelectItem>
                <SelectItem value="workflows">Workflows</SelectItem>
                <SelectItem value="integrations">Integrações</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.pricing ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, pricing: v as 'all' | 'free' | 'paid' }))}>
              <SelectTrigger className="w-[130px] bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos preços</SelectItem>
                <SelectItem value="free">Grátis</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sort ?? 'popular'} onValueChange={(v) => setFilters((f) => ({ ...f, sort: v as 'popular' | 'newest' | 'top_rated' }))}>
              <SelectTrigger className="w-[150px] bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Mais populares</SelectItem>
                <SelectItem value="newest">Novos</SelectItem>
                <SelectItem value="top_rated">Melhor avaliados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <CardGridSkeleton count={9} cols={3} />
          ) : skills.length === 0 ? (
            <EmptyState icon={Store} title="Nenhuma skill encontrada" description="Tente outros filtros." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {skills.map((s) => <SkillCard key={s.id} skill={s} onOpen={() => setSelectedSkillId(s.id)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de compras</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {purchases.length === 0 ? (
                <EmptyState icon={Download} title="Nenhuma compra ainda" description="Explore o marketplace para descobrir skills." />
              ) : purchases.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded text-sm">
                  <div>
                    <div className="font-mono text-xs">{p.skill_id.slice(0, 8)}…</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.payment_provider}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatPrice(p.amount_cents)}</div>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creator" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard icon={DollarSign} label="Receita total" value={formatPrice(earnings?.total_revenue_cents ?? 0)} />
            <StatCard icon={Wallet} label="Seu repasse (70%)" value={formatPrice(earnings?.total_payout_cents ?? 0)} accent />
            <StatCard icon={BarChart3} label="Vendas" value={String(earnings?.total_sales ?? 0)} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Vendas recentes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sales.length === 0 ? (
                <EmptyState icon={Upload} title="Nenhuma venda ainda" description="Publique skills no painel de Skills Marketplace para começar a vender." />
              ) : sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-muted/30 rounded text-sm">
                  <div>
                    <div className="font-mono text-xs">{s.skill_id.slice(0, 8)}…</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-nexus-green">+{formatPrice(s.creator_payout_cents)}</div>
                    <div className="text-[10px] text-muted-foreground">de {formatPrice(s.amount_cents)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedSkillId && (
        <SkillDetailDialog skillId={selectedSkillId} onClose={() => setSelectedSkillId(null)} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ? 'text-nexus-green' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SkillCard({ skill, onOpen }: { skill: MarketplaceSkill; onOpen: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="font-semibold text-sm truncate">{skill.name}</div>
              {skill.verified && <Shield className="h-3.5 w-3.5 text-nexus-emerald shrink-0" />}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">por {skill.author}</div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{skill.category}</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-nexus-amber text-nexus-amber" />
            {skill.avg_rating > 0 ? skill.avg_rating.toFixed(1) : '—'}
            {skill.review_count > 0 && <span className="text-muted-foreground">({skill.review_count})</span>}
          </span>
          <span className="text-muted-foreground">{skill.install_count.toLocaleString('pt-BR')} installs</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div>
            <div className="text-lg font-bold">{formatPrice(skill.price_cents)}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{skill.pricing_model.replace('_', ' ')}</div>
          </div>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Ver detalhes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillDetailDialog({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const { data: skill, isLoading } = useQuery({ queryKey: ['mkt-skill', skillId], queryFn: () => getSkill(skillId) });
  const { data: reviews = [] } = useQuery({ queryKey: ['mkt-reviews', skillId], queryFn: () => listReviews(skillId) });

  const buyMut = useMutation({
    mutationFn: () => purchaseSkill(skillId),
    onSuccess: (r) => {
      toast.success(r.amount_cents === 0 ? 'Skill instalada!' : `Compra concluída — ${formatPrice(r.amount_cents)}`);
      qc.invalidateQueries({ queryKey: ['mkt-purchases'] });
      qc.invalidateQueries({ queryKey: ['mkt-skills'] });
      qc.invalidateQueries({ queryKey: ['mkt-earnings'] });
      qc.invalidateQueries({ queryKey: ['mkt-skill', skillId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: () => submitReview(skillId, rating, comment),
    onSuccess: () => {
      toast.success('Avaliação enviada');
      setComment('');
      qc.invalidateQueries({ queryKey: ['mkt-reviews', skillId] });
      qc.invalidateQueries({ queryKey: ['mkt-skill', skillId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        {isLoading || !skill ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {skill.name}
                {skill.verified && <Shield className="h-4 w-4 text-nexus-emerald" />}
              </DialogTitle>
              <DialogDescription>v{skill.version} · por {skill.author} · {skill.category}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm">{skill.description}</p>

              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-nexus-amber text-nexus-amber" />
                  <strong>{skill.avg_rating > 0 ? skill.avg_rating.toFixed(1) : '—'}</strong>
                  <span className="text-muted-foreground">({skill.review_count} avaliações)</span>
                </span>
                <span className="text-muted-foreground">{skill.install_count.toLocaleString('pt-BR')} instalações</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border/40">
                <div>
                  <div className="text-2xl font-bold">{formatPrice(skill.price_cents)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{skill.pricing_model.replace('_', ' ')}</div>
                </div>
                <Button onClick={() => buyMut.mutate()} disabled={buyMut.isPending}>
                  {buyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {skill.price_cents === 0 ? 'Instalar grátis' : `Comprar ${formatPrice(skill.price_cents)}`}
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Deixar uma avaliação</h4>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} className="p-0.5">
                      <Star className={`h-5 w-5 ${n <= rating ? 'fill-nexus-amber text-nexus-amber' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <Textarea placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
                <Button size="sm" onClick={() => reviewMut.mutate()} disabled={reviewMut.isPending}>Enviar avaliação</Button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                <h4 className="text-sm font-semibold">Avaliações ({reviews.length})</h4>
                {reviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Seja o primeiro a avaliar.</p>
                ) : reviews.map((r) => (
                  <div key={r.id} className="p-3 rounded bg-muted/30 text-sm">
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-nexus-amber text-nexus-amber" />)}
                      <span className="text-[10px] text-muted-foreground ml-2">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {r.comment && <p className="text-xs">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
