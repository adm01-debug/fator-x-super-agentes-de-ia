/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Shared CORS Configuration
 * ═══════════════════════════════════════════════════════════════
 * Centralized CORS with domain whitelist.
 * REPLACES the dangerous `'Access-Control-Allow-Origin': '*'`
 * used across all 19 Edge Functions.
 *
 * Usage:
 *   import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";
 *
 *   // At top of handler:
 *   if (req.method === 'OPTIONS') return handleCorsPreflight(req);
 *
 *   // In responses:
 *   const cors = getCorsHeaders(req);
 *   return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json' } });
 *
 * Pattern: Dify CORS configuration + n8n allowed origins
 * ═══════════════════════════════════════════════════════════════
 */

// ═══ Allowed Origins ═══
// Add production domains here. Localhost patterns allowed in dev.
const ALLOWED_ORIGINS: string[] = [
  // Production
  'https://nexus.promobrindes.com.br',
  'https://app.promobrindes.com.br',
  'https://promobrindes.com.br',
  // Lovable preview
  'https://lovable.dev',
  // Supabase Studio
  'https://supabase.com',
];

// Patterns that match any port (for localhost dev)
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.lovable\.dev$/,
  /^https:\/\/.*\.supabase\.co$/,
  /^https:\/\/.*\.promobrindes\.com\.br$/,
];

// ═══ Allowed Headers ═══
const ALLOWED_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-api-key',
  'x-request-id',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
].join(', ');

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const MAX_AGE = '86400'; // 24 hours

// ═══ Origin Validation ═══

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check patterns
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

/**
 * Check if we're in development mode (Deno env).
 * In dev, we allow all origins for ease of development.
 */
function isDevelopment(): boolean {
  try {
    return Deno.env.get('ENVIRONMENT') === 'development' ||
           Deno.env.get('DENO_ENV') === 'development';
  } catch {
    return false;
  }
}

// ═══ Public API ═══

/**
 * Get CORS headers for a given request.
 * Returns the correct Access-Control-Allow-Origin based on the request Origin header.
 * If origin is not whitelisted, returns empty origin (browser will block).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');

  // In development, allow all origins
  if (isDevelopment()) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Max-Age': MAX_AGE,
    };
  }

  // In production, validate origin
  if (origin && isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Max-Age': MAX_AGE,
      'Vary': 'Origin',
    };
  }

  // Origin not allowed — return headers without Allow-Origin (browser blocks the request)
  return {
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Vary': 'Origin',
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns 204 No Content with appropriate CORS headers.
 */
export function handleCorsPreflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

/**
 * Create a JSON response with CORS headers.
 * Convenience helper used by all Edge Functions.
 */
export function jsonResponse(
  req: Request,
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response with CORS headers.
 */
export function errorResponse(
  req: Request,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): Response {
  return jsonResponse(
    req,
    { error: message, ...(details || {}) },
    status,
  );
}
