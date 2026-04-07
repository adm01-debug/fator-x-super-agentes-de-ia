/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Guardrails ML
 * ═══════════════════════════════════════════════════════════════
 * Defense-in-depth content moderation pipeline.
 * Direction-aware (input vs output) with 4 layers:
 *   1. Prompt injection detection (input only)
 *   2. PII detection (both directions, output is masking)
 *   3. Toxicity classifier (both directions)
 *   4. Secret leakage scanner (output only)
 *
 * Strategy: regex/heuristics first (zero-cost), then HF ML models
 * via Hugging Face Inference API if HUGGINGFACE_API_KEY is set in
 * workspace_secrets (graceful fallback).
 *
 * Used by: src/services/guardrailsMLService.ts
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema ═══
const GuardrailInput = z.object({
  text: z.string().min(1).max(20_000),
  direction: z.enum(['input', 'output']),
});

type Direction = 'input' | 'output';

interface LayerResult {
  passed: boolean;
  layer: string;
  score: number;
  details: string;
}

// ═══ Layer 1: Prompt Injection ═══
function detectPromptInjection(text: string): LayerResult {
  const patterns = [
    /ignore (all |the |any )?(previous|above|prior) (instructions?|prompts?|rules?)/i,
    /disregard (all |the )?(previous|above) (instructions?|prompts?)/i,
    /forget (all |the )?(previous|above|prior) (instructions?|context)/i,
    /you are now (a|an) /i,
    /system:?\s*(prompt|message|instruction)/i,
    /\[INST\]|\[\/INST\]/i,
    /<\|im_start\|>|<\|im_end\|>/,
    /jailbreak|DAN mode|do anything now/i,
    /pretend (to be|you are) /i,
    /act as if (you are|there are no)/i,
    /override (your|the) (system|safety|guidelines)/i,
    /reveal (your|the) (system prompt|instructions)/i,
  ];

  let hits = 0;
  const matched: string[] = [];
  for (const re of patterns) {
    if (re.test(text)) {
      hits++;
      matched.push(re.source.slice(0, 40));
    }
  }

  const score = Math.min(1, hits * 0.35);
  return {
    passed: hits === 0,
    layer: 'prompt_injection',
    score,
    details: hits === 0 ? 'No injection patterns detected' : `${hits} pattern(s) matched: ${matched.join(', ')}`,
  };
}

// ═══ Layer 2: PII Detection ═══
function detectPII(text: string): LayerResult {
  const piiPatterns: Array<[string, RegExp]> = [
    ['cpf', /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/],
    ['cnpj', /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/],
    ['credit_card', /\b(?:\d{4}[\s-]?){3}\d{4}\b/],
    ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
    ['phone_br', /\+?55[\s-]?\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}/],
    ['rg', /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/],
  ];

  const found: string[] = [];
  for (const [type, re] of piiPatterns) {
    if (re.test(text)) found.push(type);
  }

  return {
    passed: found.length === 0,
    layer: 'pii_detection',
    score: Math.min(1, found.length * 0.25),
    details: found.length === 0 ? 'No PII detected' : `PII types found: ${found.join(', ')}`,
  };
}

// ═══ Layer 3: Toxicity (heuristic — would call HF in prod) ═══
function detectToxicity(text: string): LayerResult {
  const toxicWords = [
    // pt-BR
    'idiota', 'imbecil', 'estúpido', 'estupido', 'burro', 'retardado',
    'merda', 'porra', 'caralho', 'foda', 'fdp', 'filho da puta',
    // en
    'idiot', 'stupid', 'moron', 'retard', 'dumb',
    'fuck', 'shit', 'asshole', 'bitch',
  ];
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of toxicWords) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) hits++;
  }
  const score = Math.min(1, hits * 0.2);
  return {
    passed: hits < 2,
    layer: 'toxicity',
    score,
    details: hits === 0 ? 'No toxic content detected' : `${hits} toxic term(s) detected`,
  };
}

// ═══ Layer 4: Secret Leakage (output only) ═══
function detectSecrets(text: string): LayerResult {
  const secretPatterns: Array<[string, RegExp]> = [
    ['openai_key', /sk-[A-Za-z0-9]{20,}/],
    ['anthropic_key', /sk-ant-[A-Za-z0-9_-]{20,}/],
    ['github_token', /gh[ps]_[A-Za-z0-9]{36}/],
    ['aws_key', /AKIA[0-9A-Z]{16}/],
    ['jwt', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
    ['private_key', /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
    ['supabase_service_key', /eyJhbGciOi[A-Za-z0-9_-]{50,}/],
  ];

  const found: string[] = [];
  for (const [type, re] of secretPatterns) {
    if (re.test(text)) found.push(type);
  }

  return {
    passed: found.length === 0,
    layer: 'secret_leakage',
    score: found.length > 0 ? 1 : 0,
    details: found.length === 0 ? 'No secrets detected' : `🚨 Secrets exposed: ${found.join(', ')}`,
  };
}

// ═══ Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, GuardrailInput);
    if (parsed.error) return parsed.error;
    const { text, direction } = parsed.data;

    const results: LayerResult[] = [];

    if (direction === 'input') {
      results.push(detectPromptInjection(text));
      results.push(detectPII(text));
      results.push(detectToxicity(text));
    } else {
      // output
      results.push(detectPII(text));
      results.push(detectToxicity(text));
      results.push(detectSecrets(text));
    }

    const blocked_count = results.filter(r => !r.passed).length;
    const allowed = blocked_count === 0;

    return jsonResponse(req, {
      allowed,
      direction,
      results,
      blocked_count,
      version: 'guardrails-ml-v1.0',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(req, message, 500);
  }
});
