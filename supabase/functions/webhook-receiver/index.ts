import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflight, getCorsHeaders, checkRateLimit } from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  const rateLimitResult = await checkRateLimit(req, { preset: "standard" });
  if (rateLimitResult) return rateLimitResult;

  try {
    const url = new URL(req.url);
    const webhookPath = url.searchParams.get('path');

    if (!webhookPath) {
      return new Response(
        JSON.stringify({ error: 'Missing webhook path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find webhook endpoint
    const { data: webhook, error: fetchError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('path', webhookPath)
      .eq('status', 'active')
      .single();

    if (fetchError || !webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify method
    if (!webhook.methods.includes(req.method)) {
      return new Response(
        JSON.stringify({ error: `Method ${req.method} not allowed` }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    let body: Record<string, unknown> = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    // Parse query params
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { if (k !== 'path') queryParams[k] = v; });

    // Get headers
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });

    // IP check
    const sourceIp = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
    if (webhook.ip_whitelist && webhook.ip_whitelist.length > 0) {
      if (!webhook.ip_whitelist.includes(sourceIp)) {
        await logEvent(supabase, webhook.id, req.method, headers, queryParams, body, sourceIp, 'rejected', 403);
        return new Response(
          JSON.stringify({ error: 'IP not whitelisted' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Auth verification
    if (webhook.auth_type === 'hmac_sha256') {
      const signature = headers['x-hub-signature-256'] || headers['x-signature'] || '';
      const payload = JSON.stringify(body);
      const valid = await verifyHmac(payload, signature, webhook.secret);
      if (!valid) {
        await logEvent(supabase, webhook.id, req.method, headers, queryParams, body, sourceIp, 'rejected', 401);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (webhook.auth_type === 'bearer') {
      const authHeader = headers['authorization'] || '';
      const token = authHeader.replace('Bearer ', '');
      if (token !== webhook.secret) {
        await logEvent(supabase, webhook.id, req.method, headers, queryParams, body, sourceIp, 'rejected', 401);
        return new Response(
          JSON.stringify({ error: 'Invalid bearer token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (webhook.auth_type === 'api_key') {
      const apiKey = headers['x-api-key'] || url.searchParams.get('api_key') || '';
      if (apiKey !== webhook.secret) {
        await logEvent(supabase, webhook.id, req.method, headers, queryParams, body, sourceIp, 'rejected', 401);
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log event
    const startTime = Date.now();
    await logEvent(supabase, webhook.id, req.method, headers, queryParams, body, sourceIp, 'processed', 200);

    // Update counter
    await supabase.rpc('increment_webhook_counter', { webhook_uuid: webhook.id });

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: webhook.id,
        processing_time_ms: processingTime,
        target: { type: webhook.target_type, id: webhook.target_id },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === signature.replace('sha256=', '');
  } catch {
    return false;
  }
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  webhookId: string, method: string, headers: Record<string, string>,
  queryParams: Record<string, string>, body: Record<string, unknown>,
  sourceIp: string, status: string, responseCode: number,
) {
  await supabase.from('webhook_events').insert({
    webhook_id: webhookId, method, headers, query_params: queryParams,
    body, source_ip: sourceIp, status, response_code: responseCode,
  });
}
