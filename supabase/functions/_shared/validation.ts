/**
 * Nexus Agents Studio — Shared Validation (HARDENED)
 * FIX P2-03: max length constraints on all string fields
 * FIX P2-04: body size guard before parsing
 */

import { z, type ZodSchema, type ZodError } from "https://esm.sh/zod@3.23.8";
import { errorResponse } from "./cors.ts";

// Max request body size (10MB)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

export interface ParseSuccess<T> {
  data: T;
  rawBody?: string;
  error: null;
}

export interface ParseFailure {
  data: null;
  rawBody?: string;
  error: Response;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/**
 * P2-04: Check Content-Length before parsing body.
 */
function checkBodySize(req: Request): Response | null {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return errorResponse(req, `Request body too large (max ${MAX_BODY_SIZE / 1024 / 1024}MB)`, 413);
  }
  return null;
}

/**
 * Parse and validate request body with size guard.
 * Returns raw body string for HMAC validation if needed.
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
  options: { returnRawBody?: boolean } = {}
): Promise<ParseResult<T>> {
  // P2-04: Size guard
  const sizeError = checkBodySize(req);
  if (sizeError) return { data: null, error: sizeError };

  let rawBody: string;
  let raw: unknown;

  try {
    rawBody = await req.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      return {
        data: null,
        error: errorResponse(req, `Request body too large (max ${MAX_BODY_SIZE / 1024 / 1024}MB)`, 413),
      };
    }
    raw = JSON.parse(rawBody);
  } catch {
    return {
      data: null,
      error: errorResponse(req, 'Invalid JSON body', 400),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      data: null,
      rawBody: options.returnRawBody ? rawBody : undefined,
      error: errorResponse(req, 'Validation failed', 400, {
        issues: formatZodErrors(result.error),
      }),
    };
  }

  return {
    data: result.data,
    rawBody: options.returnRawBody ? rawBody : undefined,
    error: null,
  };
}

/**
 * Parse raw body without JSON parsing (for webhook HMAC validation).
 */
export async function getRawBody(req: Request): Promise<{ body: string; error: Response | null }> {
  const sizeError = checkBodySize(req);
  if (sizeError) return { body: '', error: sizeError };

  try {
    const body = await req.text();
    if (body.length > MAX_BODY_SIZE) {
      return { body: '', error: errorResponse(req, 'Request body too large', 413) };
    }
    return { body, error: null };
  } catch {
    return { body: '', error: errorResponse(req, 'Failed to read request body', 400) };
  }
}

function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map(issue => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

// P2-03: String length limits
const MAX_SHORT_STRING = 500;
const MAX_MEDIUM_STRING = 5000;
const MAX_LONG_STRING = 50000;
const MAX_MESSAGE_CONTENT = 100000;

export const CommonSchemas = {
  uuid: z.string().uuid(),

  // P2-03: All strings have max length
  nonEmpty: z.string().min(1).max(MAX_SHORT_STRING).trim(),
  shortString: z.string().max(MAX_SHORT_STRING),
  mediumString: z.string().max(MAX_MEDIUM_STRING),
  longString: z.string().max(MAX_LONG_STRING),

  pagination: z.object({
    page: z.number().int().min(1).max(10000).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),

  sort: z.object({
    field: z.string().min(1).max(100),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),

  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),

  agentId: z.string().uuid().describe('Agent configuration ID'),
  workspaceId: z.string().uuid().describe('Workspace ID'),
  sessionId: z.string().uuid().optional().describe('Session ID'),

  // P2-03: Model name limited
  model: z.string().min(1).max(200).describe('LLM model identifier'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(200000).default(4096),

  // P2-03: Message content has explicit max
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1).max(MAX_MESSAGE_CONTENT),
    name: z.string().max(100).optional(),
    tool_call_id: z.string().max(100).optional(),
  })).min(1).max(100),

  knowledgeQuery: z.object({
    query: z.string().min(1).max(2000),
    collection_ids: z.array(z.string().uuid()).max(20).optional(),
    top_k: z.number().int().min(1).max(50).default(10),
    threshold: z.number().min(0).max(1).default(0.7),
  }),

  memoryType: z.enum([
    'short_term', 'episodic', 'semantic',
    'user_profile', 'team', 'external',
  ]),

  // Webhook event
  webhookEvent: z.object({
    event_type: z.string().min(1).max(100),
    payload: z.record(z.unknown()).optional(),
    timestamp: z.string().datetime().optional(),
  }),
} as const;

export { z };
export { MAX_BODY_SIZE, MAX_SHORT_STRING, MAX_MEDIUM_STRING, MAX_LONG_STRING };
