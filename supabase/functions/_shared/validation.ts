/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Shared Validation (Zod)
 * ═══════════════════════════════════════════════════════════════
 * Common Zod schemas and validation helpers for Edge Functions.
 * Ensures every input is validated before processing.
 *
 * Usage:
 *   import { parseBody, CommonSchemas } from "../_shared/validation.ts";
 *
 *   const parsed = await parseBody(req, MySchema);
 *   if (parsed.error) return parsed.error; // Returns 400 Response
 *   const { data } = parsed;
 *
 * Pattern: Mastra (Zod-first validation) + OpenAI SDK input schemas
 * ═══════════════════════════════════════════════════════════════
 */

import { z, type ZodSchema, type ZodError } from "https://esm.sh/zod@3.23.8";
import { errorResponse } from "./cors.ts";

// ═══ Parse + Validate Request Body ═══

export interface ParseSuccess<T> {
  data: T;
  error: null;
}

export interface ParseFailure {
  data: null;
  error: Response;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/**
 * Parse and validate the request body against a Zod schema.
 * Returns a 400 error response if validation fails with detailed field errors.
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;

  try {
    raw = await req.json();
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
      error: errorResponse(req, 'Validation failed', 400, {
        issues: formatZodErrors(result.error),
      }),
    };
  }

  return { data: result.data, error: null };
}

/**
 * Format Zod errors into human-readable field-level messages.
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map(issue => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

// ═══ Common Schemas (reusable across functions) ═══

export const CommonSchemas = {
  /** UUID v4 string */
  uuid: z.string().uuid(),

  /** Non-empty trimmed string */
  nonEmpty: z.string().min(1).trim(),

  /** Pagination params */
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),

  /** Sort params */
  sort: z.object({
    field: z.string().min(1),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),

  /** Date range filter */
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),

  /** Agent ID reference */
  agentId: z.string().uuid().describe('Agent configuration ID'),

  /** Workspace ID reference */
  workspaceId: z.string().uuid().describe('Workspace ID'),

  /** LLM model identifier */
  model: z.string().min(1).max(200).describe('LLM model identifier (e.g. claude-sonnet-4-6)'),

  /** Temperature (0-2) */
  temperature: z.number().min(0).max(2).default(0.7),

  /** Max tokens */
  maxTokens: z.number().int().min(1).max(200000).default(4096),

  /** Chat messages array */
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
  })).min(1),

  /** Knowledge base query */
  knowledgeQuery: z.object({
    query: z.string().min(1).max(2000),
    collection_ids: z.array(z.string().uuid()).optional(),
    top_k: z.number().int().min(1).max(50).default(10),
    threshold: z.number().min(0).max(1).default(0.7),
  }),

  /** Memory operation */
  memoryType: z.enum([
    'short_term', 'episodic', 'semantic',
    'user_profile', 'team', 'external',
  ]),
} as const;

// Re-export Zod for convenience so functions don't need separate import
export { z };
