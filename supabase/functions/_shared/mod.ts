/**
 * Nexus Agents Studio — Shared Edge Function Utilities (UPDATED)
 * Barrel export for all shared modules including new security.ts
 *
 * Usage:
 *   import {
 *     // CORS
 *     getCorsHeaders, handleCorsPreflight, jsonResponse, errorResponse,
 *     // Auth
 *     authenticateRequest, validateApiKey, validateWorkspaceMembership, createAdminClient,
 *     // Rate Limiting (Postgres-backed)
 *     checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
 *     // Validation
 *     parseBody, getRawBody, CommonSchemas, z,
 *     // Security
 *     constantTimeEqual, verifyHmacSignature, isIpInCidrRange, redactPII, getClientIp,
 *   } from "../_shared/mod.ts";
 */

// CORS
export {
  getCorsHeaders,
  handleCorsPreflight,
  jsonResponse,
  errorResponse,
} from "./cors.ts";

// Auth
export {
  authenticateRequest,
  createSupabaseClients,
  createAdminClient,
  getAuthUserId,
  validateApiKey,
  validateWorkspaceMembership,
  type AuthResult,
  type AuthError,
  type AuthResponse,
} from "./auth.ts";

// Rate Limiting
export {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitIdentifier,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rate-limiter.ts";

// Validation
export {
  parseBody,
  getRawBody,
  CommonSchemas,
  z,
  MAX_BODY_SIZE,
  type ParseResult,
} from "./validation.ts";

// Security (NEW)
export {
  constantTimeEqual,
  verifyHmacSignature,
  isIpInCidrRange,
  redactPII,
  redactPIIFromObject,
  getClientIp,
  KNOWN_WEBHOOK_CIDRS,
} from "./security.ts";
