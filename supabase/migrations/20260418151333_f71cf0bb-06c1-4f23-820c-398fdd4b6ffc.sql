-- Enums
CREATE TYPE public.asset_type AS ENUM ('hardware','software','cloud_resource','saas_account','network_device','mobile_device','iot','other');
CREATE TYPE public.asset_environment AS ENUM ('production','staging','development','testing');
CREATE TYPE public.asset_classification AS ENUM ('public','internal','confidential','restricted');
CREATE TYPE public.asset_status AS ENUM ('active','maintenance','decommissioned','lost');

-- Assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type public.asset_type NOT NULL DEFAULT 'hardware',
  category TEXT,
  owner_id UUID,
  custodian_id UUID,
  environment public.asset_environment NOT NULL DEFAULT 'production',
  classification public.asset_classification NOT NULL DEFAULT 'internal',
  status public.asset_status NOT NULL DEFAULT 'active',
  location TEXT,
  vendor TEXT,
  model TEXT,
  serial_number TEXT,
  ip_address TEXT,
  hostname TEXT,
  os TEXT,
  version TEXT,
  purchased_at DATE,
  warranty_until DATE,
  last_seen_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  linked_system_id UUID,
  linked_vendor_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_workspace ON public.assets(workspace_id);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_type ON public.assets(asset_type);
CREATE INDEX idx_assets_classification ON public.assets(classification);
CREATE INDEX idx_assets_warranty ON public.assets(warranty_until) WHERE warranty_until IS NOT NULL;

-- Asset audits
CREATE TABLE public.asset_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  audited_by UUID NOT NULL,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  findings TEXT,
  status_after public.asset_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_audits_asset ON public.asset_audits(asset_id);
CREATE INDEX idx_asset_audits_date ON public.asset_audits(audited_at DESC);

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view assets" ON public.assets FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "admins insert assets" ON public.assets FOR INSERT
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "admins update assets" ON public.assets FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "admins delete assets" ON public.assets FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "members view asset_audits" ON public.asset_audits FOR SELECT
  USING (asset_id IN (SELECT id FROM public.assets WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

CREATE POLICY "admins insert asset_audits" ON public.asset_audits FOR INSERT
  WITH CHECK (asset_id IN (SELECT id FROM public.assets WHERE public.is_workspace_admin(auth.uid(), workspace_id)));

-- Trigger to update last_seen_at on audit
CREATE OR REPLACE FUNCTION public.handle_asset_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.assets
    SET last_seen_at = NEW.audited_at,
        status = NEW.status_after,
        updated_at = now()
    WHERE id = NEW.asset_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_asset_audit
AFTER INSERT ON public.asset_audits
FOR EACH ROW EXECUTE FUNCTION public.handle_asset_audit();

CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: register asset
CREATE OR REPLACE FUNCTION public.register_asset(
  p_workspace_id UUID,
  p_name TEXT,
  p_asset_type public.asset_type,
  p_classification public.asset_classification DEFAULT 'internal',
  p_environment public.asset_environment DEFAULT 'production',
  p_category TEXT DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_vendor TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_serial_number TEXT DEFAULT NULL,
  p_hostname TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_version TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_purchased_at DATE DEFAULT NULL,
  p_warranty_until DATE DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  INSERT INTO public.assets(
    workspace_id, name, asset_type, classification, environment, category,
    owner_id, vendor, model, serial_number, hostname, ip_address, os, version,
    location, purchased_at, warranty_until, tags, created_by
  ) VALUES (
    p_workspace_id, p_name, p_asset_type, p_classification, p_environment, p_category,
    p_owner_id, p_vendor, p_model, p_serial_number, p_hostname, p_ip_address, p_os, p_version,
    p_location, p_purchased_at, p_warranty_until, p_tags, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: audit asset
CREATE OR REPLACE FUNCTION public.audit_asset(
  p_asset_id UUID,
  p_findings TEXT,
  p_status_after public.asset_status DEFAULT 'active',
  p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.assets WHERE id = p_asset_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'asset not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  INSERT INTO public.asset_audits(asset_id, audited_by, findings, status_after, notes)
  VALUES (p_asset_id, auth.uid(), p_findings, p_status_after, p_notes)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: decommission asset
CREATE OR REPLACE FUNCTION public.decommission_asset(
  p_asset_id UUID,
  p_reason TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.assets WHERE id = p_asset_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'asset not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.assets
    SET status = 'decommissioned', updated_at = now()
    WHERE id = p_asset_id;
  INSERT INTO public.asset_audits(asset_id, audited_by, findings, status_after, notes)
  VALUES (p_asset_id, auth.uid(), 'Decommissioned: ' || p_reason, 'decommissioned', p_reason);
END $$;

-- RPC: get asset summary
CREATE OR REPLACE FUNCTION public.get_asset_summary(p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INTEGER; v_active INTEGER; v_no_owner INTEGER;
  v_audit_overdue INTEGER; v_warranty_expiring INTEGER;
  v_by_type JSONB; v_by_classification JSONB; v_by_env JSONB;
BEGIN
  IF NOT (p_workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE owner_id IS NULL AND status != 'decommissioned'),
    COUNT(*) FILTER (WHERE status != 'decommissioned' AND (last_seen_at IS NULL OR last_seen_at < now() - interval '90 days')),
    COUNT(*) FILTER (WHERE status = 'active' AND warranty_until IS NOT NULL AND warranty_until <= (now() + interval '30 days')::date AND warranty_until >= now()::date)
  INTO v_total, v_active, v_no_owner, v_audit_overdue, v_warranty_expiring
  FROM public.assets WHERE workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_object_agg(asset_type, c), '{}'::jsonb) INTO v_by_type
  FROM (SELECT asset_type::text, COUNT(*) c FROM public.assets WHERE workspace_id = p_workspace_id AND status != 'decommissioned' GROUP BY asset_type) t;

  SELECT COALESCE(jsonb_object_agg(classification, c), '{}'::jsonb) INTO v_by_classification
  FROM (SELECT classification::text, COUNT(*) c FROM public.assets WHERE workspace_id = p_workspace_id AND status != 'decommissioned' GROUP BY classification) t;

  SELECT COALESCE(jsonb_object_agg(environment, c), '{}'::jsonb) INTO v_by_env
  FROM (SELECT environment::text, COUNT(*) c FROM public.assets WHERE workspace_id = p_workspace_id AND status != 'decommissioned' GROUP BY environment) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'no_owner', v_no_owner,
    'audit_overdue', v_audit_overdue,
    'warranty_expiring', v_warranty_expiring,
    'by_type', v_by_type,
    'by_classification', v_by_classification,
    'by_environment', v_by_env
  );
END $$;