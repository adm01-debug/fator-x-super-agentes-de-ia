// ═══ PII Detection & Redaction (Brazilian + International) ═══

const PII_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // Brazilian
  { name: 'cpf', regex: /\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}\b/g, replacement: '[CPF_REDACTED]' },
  { name: 'cnpj', regex: /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[.\s-]?\d{2}\b/g, replacement: '[CNPJ_REDACTED]' },
  { name: 'rg', regex: /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[.\s-]?\d{1}\b/g, replacement: '[RG_REDACTED]' },
  { name: 'phone_br', regex: /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)(?:9\s?\d{4}[-.\s]?\d{4}|\d{4}[-.\s]?\d{4})\b/g, replacement: '[PHONE_REDACTED]' },
  { name: 'cep', regex: /\b\d{5}[-.\s]?\d{3}\b/g, replacement: '[CEP_REDACTED]' },
  // International
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
  { name: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  { name: 'ssn', regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  { name: 'ip_address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
];

export interface PIIDetectionResult {
  redactedText: string;
  detected: Array<{ type: string; count: number; positions: number[] }>;
  hasAnyPII: boolean;
}

export function detectAndRedactPII(text: string): PIIDetectionResult {
  let redacted = text;
  const detected: Array<{ type: string; count: number; positions: number[] }> = [];

  for (const pattern of PII_PATTERNS) {
    const matches = [...text.matchAll(pattern.regex)];
    if (matches.length > 0) {
      detected.push({
        type: pattern.name,
        count: matches.length,
        positions: matches.map(m => m.index ?? 0),
      });
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
  }

  return { redactedText: redacted, detected, hasAnyPII: detected.length > 0 };
}

// ═══ Prompt Injection Detection (Multi-Layer) ═══

const INJECTION_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'high' | 'medium' | 'low' }> = [
  // Direct instruction override
  { name: 'ignore_previous', pattern: /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|directives?|rules?)/i, severity: 'high' },
  { name: 'new_instructions', pattern: /(?:new|updated?|revised?|override)\s+(?:system\s+)?instructions?:?\s/i, severity: 'high' },
  { name: 'you_are_now', pattern: /you\s+are\s+now\s+(?:a|an|the)\s/i, severity: 'high' },
  { name: 'do_anything_now', pattern: /(?:DAN|do\s+anything\s+now|jailbreak|developer\s+mode)/i, severity: 'high' },
  // System prompt extraction
  { name: 'reveal_system', pattern: /(?:reveal|show|display|output|print|repeat|echo)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|directives?)/i, severity: 'high' },
  { name: 'what_are_your_instructions', pattern: /what\s+(?:are|were)\s+(?:your|the)\s+(?:original\s+)?(?:instructions?|system\s+prompts?|rules?)/i, severity: 'medium' },
  // Role manipulation
  { name: 'pretend_to_be', pattern: /(?:pretend|act|behave)\s+(?:to\s+be|as\s+(?:if|though)|like)\s+(?:you\s+(?:are|were)\s+)?(?:a\s+)?(?:different|another|evil|malicious)/i, severity: 'high' },
  { name: 'system_role_injection', pattern: /\[?\s*system\s*\]?\s*:/i, severity: 'high' },
  // Delimiter attacks
  { name: 'markdown_injection', pattern: /```(?:system|prompt|instructions?)\n/i, severity: 'medium' },
  { name: 'xml_injection', pattern: /<\/?(?:system|prompt|instructions?|admin)[^>]*>/i, severity: 'medium' },
  // Encoding tricks
  { name: 'base64_payload', pattern: /(?:decode|base64|eval)\s*\(\s*["'][A-Za-z0-9+/=]{20,}["']/i, severity: 'high' },
  // Token manipulation
  { name: 'end_of_prompt', pattern: /(?:END\s+OF\s+(?:SYSTEM\s+)?PROMPT|BEGIN\s+USER\s+INPUT|<\|endoftext\|>|\[END\])/i, severity: 'high' },
];

export interface InjectionDetectionResult {
  isInjection: boolean;
  confidence: number; // 0-1
  detectedPatterns: Array<{ name: string; severity: string; matched: string }>;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export function detectPromptInjection(text: string): InjectionDetectionResult {
  const detectedPatterns: Array<{ name: string; severity: string; matched: string }> = [];

  for (const pattern of INJECTION_PATTERNS) {
    const match = text.match(pattern.pattern);
    if (match) {
      detectedPatterns.push({ name: pattern.name, severity: pattern.severity, matched: match[0].substring(0, 50) });
    }
  }

  // Anomaly checks
  const upperRatio = (text.replace(/[^A-Z]/g, '').length) / Math.max(text.length, 1);
  if (upperRatio > 0.6 && text.length > 50) {
    detectedPatterns.push({ name: 'excessive_caps', severity: 'low', matched: `${(upperRatio * 100).toFixed(0)}% uppercase` });
  }

  // Entropy check: very long inputs with repetitive instructions
  const instructionKeywords = (text.match(/\b(must|always|never|ignore|override|forget|system|prompt)\b/gi) || []).length;
  if (instructionKeywords > 5) {
    detectedPatterns.push({ name: 'instruction_density', severity: 'medium', matched: `${instructionKeywords} instruction keywords` });
  }

  // Score calculation
  const highCount = detectedPatterns.filter(p => p.severity === 'high').length;
  const medCount = detectedPatterns.filter(p => p.severity === 'medium').length;
  const lowCount = detectedPatterns.filter(p => p.severity === 'low').length;
  const confidence = Math.min(1, (highCount * 0.4 + medCount * 0.15 + lowCount * 0.05));

  const riskLevel: InjectionDetectionResult['riskLevel'] =
    highCount >= 2 ? 'critical' : highCount >= 1 ? 'high' : medCount >= 2 ? 'medium' : medCount >= 1 || lowCount >= 2 ? 'low' : 'none';

  return { isInjection: riskLevel !== 'none' && riskLevel !== 'low', confidence, detectedPatterns, riskLevel };
}

// ═══ Output Safety Check — detect system prompt leakage ═══
export function checkOutputSafety(output: string, systemPrompt?: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check if output contains significant parts of system prompt
  if (systemPrompt && systemPrompt.length > 50) {
    const chunks = systemPrompt.match(/.{30,}/g) || [];
    for (const chunk of chunks.slice(0, 10)) {
      if (output.includes(chunk)) {
        issues.push('system_prompt_leakage');
        break;
      }
    }
  }

  // Check for known jailbreak confirmation patterns
  const jailbreakConfirmations = [
    /(?:jailbreak|developer\s+mode)\s+(?:enabled|activated|on)/i,
    /I\s+(?:am|'m)\s+now\s+(?:in\s+)?(?:DAN|developer)\s+mode/i,
  ];
  for (const pattern of jailbreakConfirmations) {
    if (pattern.test(output)) issues.push('jailbreak_confirmation');
  }

  return { safe: issues.length === 0, issues };
}
