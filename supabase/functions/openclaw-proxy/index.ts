import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCorsPreflight, getCorsHeaders, checkRateLimit, getRateLimitIdentifier, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  const rateCheck = checkRateLimit(getRateLimitIdentifier(req), RATE_LIMITS.standard);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck, corsHeaders);

  try {
    const openclawUrl = Deno.env.get('OPENCLAW_URL') ?? 'http://187.77.151.129:3000';
    const openclawToken = Deno.env.get('OPENCLAW_API_TOKEN') ?? '';
    const body = await req.json().catch(() => ({}));
    const { action, payload } = body as { action?: string; payload?: Record<string, unknown> };

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpoints: Record<string, { method: string; path: string }> = {
      'health':       { method: 'GET',  path: '/api/health' },
      'chat':         { method: 'POST', path: '/api/v1/chat' },
      'agents':       { method: 'GET',  path: '/api/v1/agents' },
      'agent.create': { method: 'POST', path: '/api/v1/agents' },
      'agent.update': { method: 'PUT',  path: `/api/v1/agents/${payload?.agent_id ?? ''}` },
      'agent.delete': { method: 'DELETE', path: `/api/v1/agents/${payload?.agent_id ?? ''}` },
      'skills':       { method: 'GET',  path: '/api/v1/skills' },
      'skill.deploy': { method: 'POST', path: '/api/v1/skills' },
    };

    const endpoint = endpoints[action];
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}`, available: Object.keys(endpoints) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fetchOptions: RequestInit = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openclawToken}`,
      },
      signal: AbortSignal.timeout(30000),
    };

    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(`${openclawUrl}${endpoint.path}`, fetchOptions);
    const data = await response.json().catch(() => ({ raw: await response.text() }));

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        action,
        data,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'OpenClaw request timed out (30s)' : (error instanceof Error ? error.message : 'Proxy error'),
        hint: 'Verify OpenClaw is running: ssh root@187.77.151.129 "cd /docker/openclaw-sbem && docker compose ps"',
      }),
      { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
