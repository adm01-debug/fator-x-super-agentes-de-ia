/**
 * SSO Adapter — `src/lib/ssoAdapter.ts`
 *
 * Abstração para login federado enterprise: SAML 2.0, OIDC e SCIM.
 * Supabase Auth já suporta OIDC + SAML via `signInWithSSO`. Este
 * módulo padroniza:
 *
 *   - `listConfiguredProviders()` — lê `sso_providers` table
 *   - `initiateSso(domain)` — redireciona para IdP via Supabase
 *   - `parseScimProvisioningEvent` — processa POST de SCIM do IdP
 *
 * Destrava SOC2 + vendas enterprise (Okta / Azure AD / Google Workspace).
 */
import { supabase } from '@/integrations/supabase/client';

export type SsoProtocol = 'saml' | 'oidc';

export interface SsoProvider {
  id: string;
  workspace_id: string;
  domain: string; // ex: "acme.com" → auto-match por email
  protocol: SsoProtocol;
  display_name: string;
  metadata_url?: string; // SAML metadata XML
  issuer?: string; // OIDC issuer
  client_id?: string;
  scim_enabled: boolean;
  scim_bearer_token?: string; // hash do bearer; nunca retornado
  enabled: boolean;
  created_at: string;
}

export async function listConfiguredProviders(workspaceId?: string): Promise<SsoProvider[]> {
  let q = supabase
    .from('sso_providers' as never)
    .select(
      'id, workspace_id, domain, protocol, display_name, metadata_url, issuer, client_id, scim_enabled, enabled, created_at',
    )
    .eq('enabled', true);
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as unknown as SsoProvider[];
}

export async function initiateSso(domain: string): Promise<{ url: string } | { error: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithSSO({ domain });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'SSO response missing redirect URL' };
    return { url: data.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown SSO error' };
  }
}

// ─── SCIM 2.0 provisioning ───────────────────────────────────
// Implementa subconjunto do RFC 7644: User resource + Group resource.
// O edge function `sso-scim` recebe os POST/PATCH/DELETE do IdP e
// chama este helper para normalizar.

export type ScimOperation = 'create' | 'update' | 'delete';

export interface ScimUserEvent {
  operation: ScimOperation;
  external_id: string;
  email: string;
  display_name: string;
  active: boolean;
  groups: string[];
  raw: Record<string, unknown>;
}

export interface ScimGroupEvent {
  operation: ScimOperation;
  external_id: string;
  display_name: string;
  members: string[];
  raw: Record<string, unknown>;
}

export function parseScimUserPayload(body: Record<string, unknown>): ScimUserEvent {
  const schemas = Array.isArray(body.schemas) ? (body.schemas as string[]) : [];
  if (!schemas.some((s) => s.includes('User'))) {
    throw new Error('Payload SCIM inválido: schemas não inclui User');
  }
  const emailsRaw = Array.isArray(body.emails)
    ? (body.emails as Array<Record<string, unknown>>)
    : [];
  const primaryEmail = emailsRaw.find((e) => e.primary === true) ?? emailsRaw[0] ?? { value: '' };

  const groupsRaw = Array.isArray(body.groups)
    ? (body.groups as Array<Record<string, unknown>>)
    : [];

  return {
    operation: 'create',
    external_id: String(body.externalId ?? body.id ?? ''),
    email: String(primaryEmail.value ?? ''),
    display_name: String(body.displayName ?? body.userName ?? ''),
    active: body.active !== false,
    groups: groupsRaw.map((g) => String(g.value ?? g.display ?? '')).filter(Boolean),
    raw: body,
  };
}

export function parseScimGroupPayload(body: Record<string, unknown>): ScimGroupEvent {
  const schemas = Array.isArray(body.schemas) ? (body.schemas as string[]) : [];
  if (!schemas.some((s) => s.includes('Group'))) {
    throw new Error('Payload SCIM inválido: schemas não inclui Group');
  }
  const members = Array.isArray(body.members)
    ? (body.members as Array<Record<string, unknown>>)
    : [];
  return {
    operation: 'create',
    external_id: String(body.externalId ?? body.id ?? ''),
    display_name: String(body.displayName ?? ''),
    members: members.map((m) => String(m.value ?? '')).filter(Boolean),
    raw: body,
  };
}

/**
 * Valida bearer token SCIM contra o hash armazenado no provider.
 * Não usa timing-safe compare cliente-side; o edge function real
 * deve comparar server-side com pg_crypto `crypt(..)`.
 */
export async function validateScimToken(providerId: string, bearerToken: string): Promise<boolean> {
  const { data } = await supabase.functions.invoke('validate-access', {
    body: { action: 'scim_token', provider_id: providerId, token: bearerToken },
  });
  return (data as { valid?: boolean } | null)?.valid === true;
}

// ─── Email-domain matching (auto-detect IdP by email) ────────
export function matchProviderByEmail(email: string, providers: SsoProvider[]): SsoProvider | null {
  const at = email.indexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  return providers.find((p) => p.domain.toLowerCase() === domain && p.enabled) ?? null;
}
