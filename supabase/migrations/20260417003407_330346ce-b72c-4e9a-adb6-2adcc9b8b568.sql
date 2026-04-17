-- Marketplace Monetizado — Revenue Share infrastructure

-- 1. Pricing/metadata overlay para skills (skill_registry vive no DB externo)
CREATE TABLE public.skill_marketplace_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL UNIQUE,
  creator_id UUID NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  pricing_model TEXT NOT NULL DEFAULT 'free' CHECK (pricing_model IN ('free','one_time','subscription')),
  creator_payout_pct INTEGER NOT NULL DEFAULT 70 CHECK (creator_payout_pct BETWEEN 0 AND 100),
  verified BOOLEAN NOT NULL DEFAULT false,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  install_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.skill_marketplace_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads marketplace meta" ON public.skill_marketplace_meta
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "creator inserts own meta" ON public.skill_marketplace_meta
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "creator updates own meta" ON public.skill_marketplace_meta
  FOR UPDATE TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
CREATE POLICY "creator deletes own meta" ON public.skill_marketplace_meta
  FOR DELETE TO authenticated USING (creator_id = auth.uid());

CREATE TRIGGER trg_smm_updated_at BEFORE UPDATE ON public.skill_marketplace_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Compras
CREATE TABLE public.skill_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  creator_payout_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','refunded','failed')),
  payment_provider TEXT NOT NULL DEFAULT 'mock',
  payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.skill_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer reads own purchases" ON public.skill_purchases
  FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR creator_id = auth.uid());
CREATE POLICY "buyer inserts purchases" ON public.skill_purchases
  FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

-- 3. Reviews
CREATE TABLE public.skill_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (skill_id, reviewer_id)
);
ALTER TABLE public.skill_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads reviews" ON public.skill_reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviewer inserts own review" ON public.skill_reviews
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "reviewer updates own review" ON public.skill_reviews
  FOR UPDATE TO authenticated USING (reviewer_id = auth.uid());
CREATE POLICY "reviewer deletes own review" ON public.skill_reviews
  FOR DELETE TO authenticated USING (reviewer_id = auth.uid());

-- 4. Creator payouts
CREATE TABLE public.creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  payout_method TEXT,
  payout_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator reads own payouts" ON public.creator_payouts
  FOR SELECT TO authenticated USING (creator_id = auth.uid());

-- 5. Trigger: atualizar avg_rating/review_count em skill_marketplace_meta
CREATE OR REPLACE FUNCTION public.recalc_skill_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_skill_id UUID := COALESCE(NEW.skill_id, OLD.skill_id);
  v_avg NUMERIC(3,2);
  v_count INTEGER;
BEGIN
  SELECT COALESCE(AVG(rating)::numeric(3,2), 0), COUNT(*)
    INTO v_avg, v_count
    FROM public.skill_reviews WHERE skill_id = v_skill_id;
  UPDATE public.skill_marketplace_meta
    SET avg_rating = v_avg, review_count = v_count, updated_at = now()
    WHERE skill_id = v_skill_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_recalc_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.skill_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalc_skill_rating();

-- 6. RPC: purchase_skill (mock payment)
CREATE OR REPLACE FUNCTION public.purchase_skill(p_skill_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta public.skill_marketplace_meta%ROWTYPE;
  v_buyer UUID := auth.uid();
  v_payout INTEGER;
  v_fee INTEGER;
  v_purchase_id UUID;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_meta FROM public.skill_marketplace_meta WHERE skill_id = p_skill_id;
  IF NOT FOUND THEN
    -- Sem metadata = grátis, registra install só
    INSERT INTO public.skill_purchases (skill_id, buyer_id, creator_id, amount_cents, status, payment_provider)
      VALUES (p_skill_id, v_buyer, v_buyer, 0, 'completed', 'free')
      RETURNING id INTO v_purchase_id;
    RETURN jsonb_build_object('purchase_id', v_purchase_id, 'amount_cents', 0, 'status', 'completed');
  END IF;
  v_payout := (v_meta.price_cents * v_meta.creator_payout_pct) / 100;
  v_fee := v_meta.price_cents - v_payout;
  INSERT INTO public.skill_purchases (skill_id, buyer_id, creator_id, amount_cents, creator_payout_cents, platform_fee_cents, status, payment_provider)
    VALUES (p_skill_id, v_buyer, v_meta.creator_id, v_meta.price_cents, v_payout, v_fee, 'completed', 'mock')
    RETURNING id INTO v_purchase_id;
  UPDATE public.skill_marketplace_meta SET install_count = install_count + 1 WHERE skill_id = p_skill_id;
  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'amount_cents', v_meta.price_cents, 'creator_payout_cents', v_payout, 'platform_fee_cents', v_fee, 'status', 'completed');
END $$;

-- 7. RPC: creator earnings summary
CREATE OR REPLACE FUNCTION public.get_creator_earnings(p_creator_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_sales', COALESCE(COUNT(*), 0),
    'total_revenue_cents', COALESCE(SUM(amount_cents), 0),
    'total_payout_cents', COALESCE(SUM(creator_payout_cents), 0),
    'total_fees_cents', COALESCE(SUM(platform_fee_cents), 0)
  )
  FROM public.skill_purchases
  WHERE creator_id = COALESCE(p_creator_id, auth.uid())
    AND status = 'completed';
$$;

CREATE INDEX idx_smm_skill ON public.skill_marketplace_meta(skill_id);
CREATE INDEX idx_smm_creator ON public.skill_marketplace_meta(creator_id);
CREATE INDEX idx_purchases_buyer ON public.skill_purchases(buyer_id);
CREATE INDEX idx_purchases_creator ON public.skill_purchases(creator_id);
CREATE INDEX idx_reviews_skill ON public.skill_reviews(skill_id);