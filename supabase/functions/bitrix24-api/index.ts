import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const BitrixAPIInput = z.object({
  method: z.string().min(1).max(200),
  params: z.record(z.unknown()).optional().default({}),
});

async function getValidToken(supabase: ReturnType<typeof createClient>) {
  const { data: tokenData } = await supabase
    .from('workspace_secrets')
    .select('key_name, key_value')
    .in('key_name', ['bitrix24_access_token', 'bitrix24_refresh_token']);

  const tokens: Record<string, string> = {};
  (tokenData || []).forEach((t: Record<string, string>) => { tokens[t.key_name] = t.key_value; });

  if (!tokens.bitrix24_access_token) throw new Error('Bitrix24 não conectado');
  return tokens.bitrix24_access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, BitrixAPIInput);
    if (parsed.error) return parsed.error;
    const { method, params } = parsed.data;

    const token = await getValidToken(supabase);
    const domain = Deno.env.get('BITRIX24_DOMAIN');
    if (!domain) return errorResponse(req, 'BITRIX24_DOMAIN not configured', 503);

    const resp = await fetch(`https://${domain}/rest/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(params),
    });

    const result = await resp.json();
    return jsonResponse(req, result);

  } catch (error) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
