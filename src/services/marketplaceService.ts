/**
 * Marketplace Monetizado — Revenue Share Service
 * skill_registry vive no DB externo; meta/purchases/reviews/payouts vivem no Cloud.
 */
import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { fromTable, rpcCall } from '@/lib/supabaseExtended';

export interface MarketplaceSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  // Marketplace meta (overlay)
  price_cents: number;
  pricing_model: 'free' | 'one_time' | 'subscription';
  creator_id: string | null;
  creator_payout_pct: number;
  verified: boolean;
  avg_rating: number;
  review_count: number;
  install_count: number;
}

export interface SkillReview {
  id: string;
  skill_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface SkillPurchase {
  id: string;
  skill_id: string;
  buyer_id: string;
  creator_id: string;
  amount_cents: number;
  creator_payout_cents: number;
  platform_fee_cents: number;
  status: string;
  payment_provider: string;
  created_at: string;
}

export interface CreatorEarnings {
  total_sales: number;
  total_revenue_cents: number;
  total_payout_cents: number;
  total_fees_cents: number;
}

export interface ListSkillsFilters {
  category?: string;
  search?: string;
  pricing?: 'all' | 'free' | 'paid';
  minRating?: number;
  sort?: 'popular' | 'newest' | 'top_rated';
  limit?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeMeta(skill: any, meta: any | undefined): MarketplaceSkill {
  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description ?? '',
    version: skill.version ?? '1.0.0',
    author: skill.author ?? 'Anônimo',
    category: skill.category ?? 'tools',
    tags: skill.tags ?? [],
    price_cents: meta?.price_cents ?? 0,
    pricing_model: meta?.pricing_model ?? 'free',
    creator_id: meta?.creator_id ?? null,
    creator_payout_pct: meta?.creator_payout_pct ?? 70,
    verified: meta?.verified ?? false,
    avg_rating: Number(meta?.avg_rating ?? 0),
    review_count: meta?.review_count ?? 0,
    install_count: meta?.install_count ?? skill.install_count ?? 0,
  };
}

export async function listSkills(filters: ListSkillsFilters = {}): Promise<MarketplaceSkill[]> {
  const { category, search, pricing = 'all', minRating = 0, sort = 'popular', limit = 60 } = filters;

  let q = supabaseExternal.from('skill_registry').select('*').eq('is_public', true).limit(limit);
  if (category && category !== 'all') q = q.eq('category', category);
  if (search) q = q.ilike('name', `%${search}%`);
  if (sort === 'newest') q = q.order('created_at', { ascending: false });
  else q = q.order('install_count', { ascending: false });

  const { data: skills, error } = await q;
  if (error) throw error;
  const ids = (skills ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data: metas } = await fromTable('skill_marketplace_meta').select('*').in('skill_id', ids);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>((metas ?? []).map((m: any) => [m.skill_id, m]));

  let merged = (skills ?? []).map((s) => mergeMeta(s, byId.get(s.id)));
  if (pricing === 'free') merged = merged.filter((s) => s.price_cents === 0);
  if (pricing === 'paid') merged = merged.filter((s) => s.price_cents > 0);
  if (minRating > 0) merged = merged.filter((s) => s.avg_rating >= minRating);
  if (sort === 'top_rated') merged.sort((a, b) => b.avg_rating - a.avg_rating);
  return merged;
}

export async function getSkill(skillId: string): Promise<MarketplaceSkill | null> {
  const { data: skill, error } = await supabaseExternal
    .from('skill_registry')
    .select('*')
    .eq('id', skillId)
    .maybeSingle();
  if (error) throw error;
  if (!skill) return null;
  const { data: meta } = await fromTable('skill_marketplace_meta')
    .select('*')
    .eq('skill_id', skillId)
    .maybeSingle();
  return mergeMeta(skill, meta);
}

export async function purchaseSkill(skillId: string): Promise<{ purchase_id: string; amount_cents: number }> {
  const { data, error } = await rpcCall('purchase_skill', { p_skill_id: skillId });
  if (error) throw new Error(error.message);
  return data as { purchase_id: string; amount_cents: number };
}

export async function listReviews(skillId: string): Promise<SkillReview[]> {
  const { data, error } = await fromTable('skill_reviews')
    .select('*')
    .eq('skill_id', skillId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillReview[];
}

export async function submitReview(skillId: string, rating: number, comment: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Login necessário');
  const { error } = await fromTable('skill_reviews').upsert(
    { skill_id: skillId, reviewer_id: user.id, rating, comment: comment || null },
    { onConflict: 'skill_id,reviewer_id' }
  );
  if (error) throw new Error(error.message);
}

export async function getMyPurchases(): Promise<SkillPurchase[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await fromTable('skill_purchases')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillPurchase[];
}

export async function getCreatorEarnings(): Promise<CreatorEarnings> {
  const { data, error } = await rpcCall('get_creator_earnings', {});
  if (error) throw new Error(error.message);
  return (data as CreatorEarnings) ?? { total_sales: 0, total_revenue_cents: 0, total_payout_cents: 0, total_fees_cents: 0 };
}

export async function getCreatorSales(): Promise<SkillPurchase[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await fromTable('skill_purchases')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillPurchase[];
}

export async function upsertSkillMeta(input: {
  skill_id: string;
  price_cents: number;
  pricing_model: 'free' | 'one_time' | 'subscription';
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Login necessário');
  const { error } = await fromTable('skill_marketplace_meta').upsert(
    { ...input, creator_id: user.id },
    { onConflict: 'skill_id' }
  );
  if (error) throw new Error(error.message);
}

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Grátis';
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}
