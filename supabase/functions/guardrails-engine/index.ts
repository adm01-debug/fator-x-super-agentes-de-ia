/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Guardrails Engine
 * ═══════════════════════════════════════════════════════════════
 * 4-layer defense-in-depth: Input → Dialog → Output → Runtime
 * Reference: NeMo Guardrails (NVIDIA), LlamaFirewall (Meta), LLM Guard
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const GuardrailInput = z.object({
  action: z.enum(['check_input', 'check_output', 'check_full', 'get_config']),
  text: z.string().max(50000).optional(),
  agent_id: z.string().uuid().optional(),
  context: z.record(z.unknown()).optional(),
});

interface RailResult {
  rail: string;
  layer: 'input' | 'dialog' | 'output' | 'runtime';
  action: 'allow' | 'block' | 'warn' | 'modify';
  confidence: number;
  reason: string;
}

// ═══ Rail Implementations ═══

function checkPromptInjection(text: string): RailResult {
  const injectionPatterns = [
    /ignore (all |your |previous |above )?instructions/i,
    /disregard (all |your |previous )?instructions/i,
    /you are now (a |an )?/i,
    /pretend (you are|to be)/i,
    /jailbreak/i,
    /DAN mode/i,
    /do anything now/i,
    /bypass (your |the )?filters/i,
    /\bsudo\b.*\bmode\b/i,
    /reveal (your |the )?(system |internal )?prompt/i,
  ];

  const matches = injectionPatterns.filter(p => p.test(text));

  if (matches.length >= 2) {
    return { rail: 'prompt_injection', layer: 'input', action: 'block', confidence: 0.95, reason: 'Multiple prompt injection patterns detected' };
  }
  if (matches.length === 1) {
    return { rail: 'prompt_injection', layer: 'input', action: 'warn', confidence: 0.7, reason: 'Possible prompt injection pattern' };
  }
  return { rail: 'prompt_injection', layer: 'input', action: 'allow', confidence: 0.1, reason: 'No injection patterns found' };
}

function checkPII(text: string): RailResult {
  const piiPatterns = [
    { name: 'CPF', pattern: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g },
    { name: 'CNPJ', pattern: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g },
    { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'phone', pattern: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g },
    { name: 'credit_card', pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g },
  ];

  const found = piiPatterns.filter(p => p.pattern.test(text));

  if (found.length > 0) {
    return { rail: 'pii_detection', layer: 'output', action: 'warn', confidence: 0.85, reason: `PII detected: ${found.map(f => f.name).join(', ')}` };
  }
  return { rail: 'pii_detection', layer: 'output', action: 'allow', confidence: 0.1, reason: 'No PII detected' };
}

function checkToxicity(text: string): RailResult {
  const toxicPatterns = [
    /\b(idiota|imbecil|burro|estúpido|lixo|inútil)\b/gi,
  ];

  const matches = toxicPatterns.filter(p => p.test(text));
  if (matches.length > 0) {
    return { rail: 'toxicity', layer: 'output', action: 'warn', confidence: 0.7, reason: 'Potentially toxic language detected' };
  }
  return { rail: 'toxicity', layer: 'output', action: 'allow', confidence: 0.1, reason: 'No toxic language detected' };
}

function checkSecretLeakage(text: string): RailResult {
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,           // OpenAI API key
    /sk-ant-[a-zA-Z0-9]{20,}/,       // Anthropic API key
    /ghp_[a-zA-Z0-9]{36}/,           // GitHub token
    /Bearer [a-zA-Z0-9-._~+\/]+=*/,  // Bearer tokens
    /password\s*[:=]\s*\S+/i,        // Passwords in text
  ];

  const found = secretPatterns.filter(p => p.test(text));
  if (found.length > 0) {
    return { rail: 'secret_leakage', layer: 'output', action: 'block', confidence: 0.95, reason: 'API key or secret detected in output' };
  }
  return { rail: 'secret_leakage', layer: 'output', action: 'allow', confidence: 0.1, reason: 'No secrets detected' };
}

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
    const { action, text } = parsed.data;

    if (action === 'get_config') {
      return jsonResponse(req, {
        rails: ['prompt_injection', 'pii_detection', 'toxicity', 'secret_leakage'],
        layers: ['input', 'dialog', 'output', 'runtime'],
        levels: ['relaxed', 'standard', 'strict', 'paranoid'],
      });
    }

    if (!text) return errorResponse(req, 'text required', 400);

    const results: RailResult[] = [];

    if (action === 'check_input' || action === 'check_full') {
      results.push(checkPromptInjection(text));
    }

    if (action === 'check_output' || action === 'check_full') {
      results.push(checkPII(text));
      results.push(checkToxicity(text));
      results.push(checkSecretLeakage(text));
    }

    const blocked = results.filter(r => r.action === 'block');
    const warnings = results.filter(r => r.action === 'warn');
    const overallAction = blocked.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'allow';

    return jsonResponse(req, {
      action: overallAction,
      results,
      blocked: blocked.length,
      warnings: warnings.length,
      passed: results.filter(r => r.action === 'allow').length,
    });

  } catch (error) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
