import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflight, getCorsHeaders, checkRateLimit, getRateLimitIdentifier, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  const rateCheck = checkRateLimit(getRateLimitIdentifier(req), RATE_LIMITS.standard);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck, corsHeaders);

  const start = Date.now();
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Check database connectivity
  try {
    const dbStart = Date.now();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error } = await supabase.from('workspaces').select('id').limit(1);
    checks.database = {
      status: error ? 'degraded' : 'healthy',
      latency_ms: Date.now() - dbStart,
      ...(error && { error: error.message }),
    };
  } catch (e) {
    checks.database = { status: 'down', error: e instanceof Error ? e.message : String(e) };
  }

  // Check Edge Function runtime
  checks.runtime = {
    status: 'healthy',
    latency_ms: 0,
  };

  // Overall status
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  const anyDown = Object.values(checks).some((c) => c.status === 'down');
  const overallStatus = anyDown ? 'down' : allHealthy ? 'healthy' : 'degraded';

  return new Response(
    JSON.stringify({
      status: overallStatus,
      checks,
      uptime_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }),
    {
      status: overallStatus === 'down' ? 503 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
