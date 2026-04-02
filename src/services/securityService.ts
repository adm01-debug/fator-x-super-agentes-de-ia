/**
 * Security Service — PII Detection/Redaction + Multi-layer Prompt Injection Detection
 * Implements OWASP Top 10 for LLMs defenses.
 */
import { logger } from '@/lib/logger';

// ═══ PII DETECTION (Microsoft Presidio-inspired) ═══

export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  score: number;
}

export interface PIIResult {
  found: PIIMatch[];
  redactedText: string;
  hasHighRisk: boolean;
}

const PII_PATTERNS: { type: string; pattern: RegExp; replacement: string; score: number }[] = [
  // CPF (Brazilian)
  { type: 'CPF', pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: '[CPF_REDACTED]', score: 0.95 },
  // CNPJ (Brazilian)
  { type: 'CNPJ', pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replacement: '[CNPJ_REDACTED]', score: 0.9 },
  // Email
  { type: 'EMAIL', pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, replacement: '[EMAIL_REDACTED]', score: 0.95 },
  // Phone (BR format)
  { type: 'PHONE', pattern: /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, replacement: '[PHONE_REDACTED]', score: 0.85 },
  // Credit Card
  { type: 'CREDIT_CARD', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CARD_REDACTED]', score: 0.95 },
  // RG (Brazilian ID)
  { type: 'RG', pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/g, replacement: '[RG_REDACTED]', score: 0.7 },
  // IP Address
  { type: 'IP_ADDRESS', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP_REDACTED]', score: 0.8 },
  // Date of Birth patterns
  { type: 'DOB', pattern: /\b(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g, replacement: '[DATE_REDACTED]', score: 0.6 },
  // API Key patterns
  { type: 'API_KEY', pattern: /\b(?:sk-|key-|api[_-]?key[:\s=]+)[a-zA-Z0-9_-]{10,}\b/gi, replacement: '[KEY_REDACTED]', score: 0.95 },
  // Password patterns
  { type: 'PASSWORD', pattern: /(?:senha|password|pwd)[:\s=]+\S+/gi, replacement: '[PASSWORD_REDACTED]', score: 0.9 },
];

/** Detect PII in text. Returns matches and optionally redacted text. */
export function detectPII(text: string): PIIResult {
  const found: PIIMatch[] = [];
  let redactedText = text;

  for (const pattern of PII_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      found.push({ type: pattern.type, value: match[0], start: match.index, end: match.index + match[0].length, score: pattern.score });
    }
    redactedText = redactedText.replace(pattern.pattern, pattern.replacement);
  }

  const hasHighRisk = found.some(m => m.score >= 0.9);

  if (found.length > 0) {
    logger.info(`PII detected: ${found.length} matches (${found.map(f => f.type).join(', ')})`, 'securityService');
  }

  return { found, redactedText, hasHighRisk };
}

/** Redact PII from text. Returns clean text. */
export function redactPII(text: string): string {
  return detectPII(text).redactedText;
}

// ═══ PROMPT INJECTION DETECTION (Multi-Layer) ═══

export interface InjectionResult {
  isInjection: boolean;
  score: number; // 0-100 confidence
  detectedPatterns: string[];
  layer: string;
  recommendation: 'allow' | 'warn' | 'block';
}

// Layer 1: Pattern-based rules (fast, low false positive)
const INJECTION_PATTERNS: { name: string; pattern: RegExp; severity: number }[] = [
  // Direct instruction override
  { name: 'ignore_instructions', pattern: /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts?|rules?|constraints?)/i, severity: 95 },
  { name: 'new_instructions', pattern: /(?:your\s+)?new\s+instructions?\s+(?:are|is|:)/i, severity: 90 },
  { name: 'you_are_now', pattern: /you\s+are\s+now\s+(?:a|an|the)\s+/i, severity: 85 },
  { name: 'forget_everything', pattern: /forget\s+(?:all|everything|what|your)/i, severity: 90 },
  // Jailbreak attempts
  { name: 'jailbreak_dan', pattern: /\bDAN\b.*\bmode\b|\bDAN\b.*\bjailbreak\b/i, severity: 95 },
  { name: 'jailbreak_developer', pattern: /developer\s+mode|debug\s+mode|god\s+mode|admin\s+mode/i, severity: 85 },
  { name: 'jailbreak_pretend', pattern: /pretend\s+(?:you\s+)?(?:are|can|have|don'?t)/i, severity: 70 },
  { name: 'jailbreak_hypothetical', pattern: /hypothetically?\s+(?:if|what|how|could|would)/i, severity: 30 },
  // System prompt extraction
  { name: 'extract_prompt', pattern: /(?:show|reveal|display|print|output|repeat)\s+(?:your\s+)?(?:system|initial|original)\s+(?:prompt|instructions|message)/i, severity: 90 },
  { name: 'what_is_prompt', pattern: /what\s+(?:is|are)\s+your\s+(?:system|initial|original)\s+(?:prompt|instructions)/i, severity: 80 },
  // Encoding bypass
  { name: 'base64_injection', pattern: /(?:decode|base64|atob|btoa)\s*\(/i, severity: 60 },
  { name: 'unicode_injection', pattern: /\\u[0-9a-f]{4}/i, severity: 40 },
  // Output manipulation
  { name: 'output_format_override', pattern: /(?:respond|answer|output|return)\s+(?:only|just)\s+(?:with|in)\s+(?:json|xml|html|code)/i, severity: 30 },
  // Social engineering
  { name: 'emergency_override', pattern: /(?:this\s+is\s+an?\s+)?(?:emergency|urgent|critical|life.threatening)/i, severity: 40 },
  { name: 'authority_claim', pattern: /(?:i\s+am\s+(?:the|your|an?)\s+)?(?:administrator|developer|owner|creator|CEO|CTO)/i, severity: 50 },
];

// Layer 2: Structural analysis (medium speed, medium accuracy)
function structuralAnalysis(text: string): { score: number; findings: string[] } {
  const findings: string[] = [];
  let score = 0;

  // Unusual delimiter usage (trying to break out of context)
  const delimiterCount = (text.match(/```|---|\*\*\*|===|###/g) ?? []).length;
  if (delimiterCount > 3) { score += 20; findings.push('excessive_delimiters'); }

  // Role-play indicators
  if (/\[system\]|\[assistant\]|\[user\]|<\|im_start\|>|<\|endoftext\|>/i.test(text)) {
    score += 40; findings.push('role_markers');
  }

  // XML/HTML injection
  if (/<\/?(?:system|prompt|instruction|context|override)>/i.test(text)) {
    score += 35; findings.push('xml_injection');
  }

  // Excessive length (potential prompt stuffing)
  if (text.length > 10000) { score += 10; findings.push('excessive_length'); }

  // Multiple languages mixing (potential obfuscation)
  const hasLatin = /[a-zA-Z]/.test(text);
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const languageCount = [hasLatin, hasCyrillic, hasChinese].filter(Boolean).length;
  if (languageCount >= 2) { score += 15; findings.push('mixed_scripts'); }

  return { score: Math.min(score, 100), findings };
}

/** Multi-layer prompt injection detection. */
export function detectInjection(text: string): InjectionResult {
  const detectedPatterns: string[] = [];
  let maxSeverity = 0;

  // Layer 1: Pattern matching
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.pattern.test(text)) {
      detectedPatterns.push(pattern.name);
      maxSeverity = Math.max(maxSeverity, pattern.severity);
    }
  }

  // Layer 2: Structural analysis
  const structural = structuralAnalysis(text);
  detectedPatterns.push(...structural.findings);
  const combinedScore = Math.min(Math.max(maxSeverity, structural.score), 100);

  const isInjection = combinedScore >= 50;
  const recommendation = combinedScore >= 80 ? 'block' : combinedScore >= 50 ? 'warn' : 'allow';

  if (isInjection) {
    logger.warn(`Injection detected (score: ${combinedScore}): ${detectedPatterns.join(', ')}`, 'securityService');
  }

  return { isInjection, score: combinedScore, detectedPatterns, layer: maxSeverity > structural.score ? 'pattern' : 'structural', recommendation };
}

// ═══ COMBINED SECURITY CHECK ═══

export interface SecurityCheckResult {
  allowed: boolean;
  pii: PIIResult;
  injection: InjectionResult;
  sanitizedInput: string;
  blockedReason?: string;
}

/** Run full security check on input: PII detection + redaction + injection detection. */
export function checkInputSecurity(input: string): SecurityCheckResult {
  const pii = detectPII(input);
  const injection = detectInjection(input);

  let sanitizedInput = input;
  let allowed = true;
  let blockedReason: string | undefined;

  // Apply PII redaction to input before sending to LLM
  if (pii.found.length > 0) {
    sanitizedInput = pii.redactedText;
  }

  // Block on high-confidence injection
  if (injection.recommendation === 'block') {
    allowed = false;
    blockedReason = `Prompt injection detectado (score: ${injection.score}%, patterns: ${injection.detectedPatterns.slice(0, 3).join(', ')})`;
  }

  return { allowed, pii, injection, sanitizedInput, blockedReason };
}

/** Run security check on LLM output before returning to user. */
export function checkOutputSecurity(output: string): { sanitizedOutput: string; piiFound: PIIMatch[] } {
  const pii = detectPII(output);
  return { sanitizedOutput: pii.redactedText, piiFound: pii.found };
}
