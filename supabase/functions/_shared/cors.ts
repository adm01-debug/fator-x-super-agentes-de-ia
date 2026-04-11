/**
 * Nexus Agents Studio — Shared CORS (HARDENED)
 * FIX P0-08: whitelist .lovable.app + x-workspace-id header + Vary: Origin
 */
const ALLOWED_ORIGINS: string[] = [
  'https://nexus.promobrindes.com.br',
  'https://app.promobrindes.com.br',
  'https://promobrindes.com.br',
  'https://lovable.dev',
  'https://supabase.com',
];
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.lovable\.dev$/,
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.supabase\.co$/,
  /^https:\/\/.*\.promobrindes\.com\.br$/,
];
const ALLOWED_HEADERS = ['authorization','x-client-info','apikey','content-type','x-api-key','x-request-id','x-workspace-id','x-supabase-client-platform','x-supabase-client-platform-version','x-supabase-client-runtime','x-supabase-client-runtime-version'].join(', ');
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const MAX_AGE = '86400';
function isOriginAllowed(o: string | null): boolean {
  if (!o) return false;
  if (ALLOWED_ORIGINS.includes(o)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some(p => p.test(o));
}
function isDevelopment(): boolean {
  try { return Deno.env.get('ENVIRONMENT') === 'development' || Deno.env.get('DENO_ENV') === 'development'; }
  catch { return false; }
}
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (isDevelopment()) {
    return { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': ALLOWED_HEADERS, 'Access-Control-Allow-Methods': ALLOWED_METHODS, 'Access-Control-Max-Age': MAX_AGE, 'Vary': 'Origin' };
  }
  if (origin && isOriginAllowed(origin)) {
    return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': ALLOWED_HEADERS, 'Access-Control-Allow-Methods': ALLOWED_METHODS, 'Access-Control-Max-Age': MAX_AGE, 'Vary': 'Origin' };
  }
  return { 'Access-Control-Allow-Headers': ALLOWED_HEADERS, 'Access-Control-Allow-Methods': ALLOWED_METHODS, 'Vary': 'Origin' };
}
export function handleCorsPreflight(req: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}
export function jsonResponse(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
}
export function errorResponse(req: Request, message: string, status = 400, details?: Record<string, unknown>): Response {
  return jsonResponse(req, { error: message, ...(details || {}) }, status);
}
