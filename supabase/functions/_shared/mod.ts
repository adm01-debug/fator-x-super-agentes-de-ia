/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Shared Edge Function Utilities
 * ═══════════════════════════════════════════════════════════════
 * Barrel export for all shared modules.
 *
 * Usage in any Edge Function:
 *   import {
 *     // CORS
 *     getCorsHeaders, handleCorsPreflight, jsonResponse, errorResponse,
 *     // Auth
 *     authenticateRequest, validateApiKey,
 *     // Rate Limiting
 *     checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
 *     // Validation
 *     parseBody, CommonSchemas, z,
 *   } from "../_shared/mod.ts";
 * ═══════════════════════════════════════════════════════════════
 */

export {
  getCorsHeaders,
  handleCorsPreflight,
  jsonResponse,
  errorResponse,
} from "./cors.ts";

export {
  authenticateRequest,
  createSupabaseClients,
  getAuthUserId,
  validateApiKey,
  type AuthResult,
  type AuthError,
  type AuthResponse,
} from "./auth.ts";

export {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitIdentifier,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rate-limiter.ts";

export {
  parseBody,
  CommonSchemas,
  z,
  type ParseResult,
} from "./validation.ts";

export {
  createLogger,
} from "./logger.ts";
