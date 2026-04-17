/**
 * Nexus — Guardrails Library
 * Presets prontos baseados em melhores práticas (OWASP LLM Top 10, NIST AI RMF, LGPD).
 * Cada preset é um "template" que cria uma guardrail_policy configurada.
 */
export type GuardrailPresetCategory = "pii" | "safety" | "injection" | "compliance" | "quality" | "cost";

export interface GuardrailPreset {
  id: string;
  name: string;
  type: "content_filter" | "pii_detection" | "prompt_injection" | "toxicity" | "custom";
  category: GuardrailPresetCategory;
  description: string;
  rationale: string; // why use this
  severity: "block" | "warn" | "log";
  config: Record<string, unknown>;
  tags: string[];
  popularity: number; // 1-5 stars
  framework?: string[]; // e.g. ["LGPD", "OWASP-LLM01"]
}

export const GUARDRAIL_PRESETS: GuardrailPreset[] = [
  // ═══ PII / DADOS PESSOAIS ═══
  {
    id: "pii-br-cpf-cnpj",
    name: "Detector de CPF/CNPJ (BR)",
    type: "pii_detection",
    category: "pii",
    description: "Detecta e mascara CPF e CNPJ em inputs e outputs.",
    rationale: "Conformidade LGPD: dados pessoais identificáveis não devem trafegar em prompts/respostas sem consentimento.",
    severity: "block",
    config: {
      patterns: ["\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}", "\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}"],
      action: "mask",
      mask_char: "*",
    },
    tags: ["LGPD", "Brasil", "PII"],
    popularity: 5,
    framework: ["LGPD"],
  },
  {
    id: "pii-email-phone",
    name: "Email & Telefone",
    type: "pii_detection",
    category: "pii",
    description: "Identifica endereços de email e números de telefone (BR/internacional).",
    rationale: "Evita vazamento de dados de contato em logs e respostas públicas.",
    severity: "warn",
    config: {
      patterns: ["[\\w.-]+@[\\w.-]+\\.\\w+", "\\+?\\d{2}?\\s?\\(?\\d{2,3}\\)?\\s?\\d{4,5}-?\\d{4}"],
      action: "mask",
    },
    tags: ["LGPD", "GDPR", "PII"],
    popularity: 5,
    framework: ["LGPD", "GDPR"],
  },
  {
    id: "pii-credit-card",
    name: "Cartões de Crédito",
    type: "pii_detection",
    category: "pii",
    description: "Detecta números de cartão (Visa, Master, Amex, Elo) com validação Luhn.",
    rationale: "PCI-DSS proíbe armazenar/transmitir PAN sem criptografia — guardrail crítico.",
    severity: "block",
    config: { patterns: ["\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"], luhn_check: true, action: "block" },
    tags: ["PCI-DSS", "Financeiro"],
    popularity: 5,
    framework: ["PCI-DSS"],
  },
  {
    id: "pii-medical",
    name: "Dados de Saúde",
    type: "pii_detection",
    category: "pii",
    description: "Identifica termos médicos sensíveis (CID-10, CRM, prontuário).",
    rationale: "Dados de saúde são sensíveis sob LGPD Art. 11. Bloqueio em produção é obrigatório.",
    severity: "block",
    config: { keywords: ["CID-10", "CRM", "prontuário", "diagnóstico", "HIV", "câncer"], action: "warn" },
    tags: ["LGPD", "Saúde", "Sensível"],
    popularity: 4,
    framework: ["LGPD-Art11"],
  },

  // ═══ PROMPT INJECTION ═══
  {
    id: "injection-classic",
    name: "Anti-Prompt Injection",
    type: "prompt_injection",
    category: "injection",
    description: "Bloqueia padrões clássicos: 'ignore as instruções anteriores', 'system:', delimitadores forjados.",
    rationale: "OWASP LLM01 — vulnerabilidade #1 em apps LLM. Essencial para qualquer agente público.",
    severity: "block",
    config: {
      patterns: [
        "ignore (all|any|previous|the above)",
        "disregard.{0,20}(prior|previous|above|system)",
        "you are now",
        "new (instructions|persona|role)",
        "</?(system|instruction|prompt)>",
      ],
      ml_model: "deberta-v3-injection",
      threshold: 0.85,
    },
    tags: ["OWASP", "Crítico", "ML"],
    popularity: 5,
    framework: ["OWASP-LLM01"],
  },
  {
    id: "injection-jailbreak",
    name: "Anti-Jailbreak (DAN, etc)",
    type: "prompt_injection",
    category: "injection",
    description: "Detecta tentativas de jailbreak conhecidas (DAN, AIM, role-play malicioso).",
    rationale: "Personas adversárias são vetor comum para extrair conteúdo proibido. Bloqueio recomendado.",
    severity: "block",
    config: { keywords: ["DAN", "AIM mode", "developer mode", "no restrictions", "evil persona"], action: "block" },
    tags: ["OWASP", "Jailbreak"],
    popularity: 4,
    framework: ["OWASP-LLM01"],
  },

  // ═══ SAFETY / TOXICIDADE ═══
  {
    id: "safety-toxic",
    name: "Filtro de Toxicidade",
    type: "toxicity",
    category: "safety",
    description: "ML-based: detecta linguagem ofensiva, ódio, assédio (toxic-bert).",
    rationale: "Reputação da marca + conformidade. Threshold 0.85 evita falsos positivos em discussões legítimas.",
    severity: "block",
    config: { ml_model: "unitary/toxic-bert", threshold: 0.85, action: "block" },
    tags: ["ML", "Conteúdo"],
    popularity: 5,
  },
  {
    id: "safety-violence",
    name: "Conteúdo Violento",
    type: "content_filter",
    category: "safety",
    description: "Bloqueia descrições explícitas de violência, automutilação, suicídio.",
    rationale: "Diretriz ética + responsabilidade legal em apps consumer. Encaminhe para CVV quando detectado.",
    severity: "block",
    config: { categories: ["violence", "self_harm", "suicide"], action: "block_and_redirect", redirect_message: "Por favor, busque ajuda em CVV: 188" },
    tags: ["Consumer", "Crítico"],
    popularity: 4,
  },

  // ═══ COMPLIANCE ═══
  {
    id: "compliance-lgpd",
    name: "LGPD — Consentimento Explícito",
    type: "custom",
    category: "compliance",
    description: "Bloqueia coleta de dados sem registro de consentimento ativo do titular.",
    rationale: "Art. 7º LGPD — base legal obrigatória. Integre com seu sistema de consent management.",
    severity: "block",
    config: { require_consent: true, consent_table: "consent_records", action: "block" },
    tags: ["LGPD", "Brasil"],
    popularity: 4,
    framework: ["LGPD-Art7"],
  },
  {
    id: "compliance-financial",
    name: "Aviso Regulatório (Investimentos)",
    type: "content_filter",
    category: "compliance",
    description: "Adiciona disclaimer obrigatório quando agente fala sobre investimentos.",
    rationale: "CVM exige aviso claro de que conteúdo não é recomendação. Aplica auto-injeção no output.",
    severity: "warn",
    config: {
      keywords: ["investir", "ação", "renda fixa", "criptomoeda", "bitcoin"],
      action: "append_disclaimer",
      disclaimer: "⚠️ Esta informação é educacional e não constitui recomendação de investimento. Consulte um profissional habilitado.",
    },
    tags: ["CVM", "Financeiro"],
    popularity: 3,
    framework: ["CVM"],
  },

  // ═══ QUALITY ═══
  {
    id: "quality-hallucination",
    name: "Detector de Alucinação",
    type: "custom",
    category: "quality",
    description: "Verifica se a resposta cita fontes do RAG. Sinaliza quando não houver grounding.",
    rationale: "Alucinação é o #1 problema de confiança. Exigir citações eleva precisão para >95%.",
    severity: "warn",
    config: { require_citations: true, min_citations: 1, action: "warn" },
    tags: ["RAG", "Confiança"],
    popularity: 5,
  },
  {
    id: "quality-format-json",
    name: "Validador JSON Schema",
    type: "custom",
    category: "quality",
    description: "Valida que a saída segue o JSON Schema definido. Re-tenta até 3x se falhar.",
    rationale: "Para integrações downstream que esperam estrutura. Evita parsing errors em produção.",
    severity: "block",
    config: { format: "json_schema", retry_on_fail: 3, action: "regenerate" },
    tags: ["API", "Integração"],
    popularity: 4,
  },

  // ═══ COST ═══
  {
    id: "cost-token-budget",
    name: "Budget de Tokens por Sessão",
    type: "custom",
    category: "cost",
    description: "Interrompe a sessão quando ultrapassa N tokens (default 50k).",
    rationale: "Previne loops infinitos e usuários abusivos drenarem o budget mensal.",
    severity: "block",
    config: { max_tokens_per_session: 50000, action: "block" },
    tags: ["FinOps"],
    popularity: 5,
  },
  {
    id: "cost-rate-limit",
    name: "Rate Limit por Usuário",
    type: "custom",
    category: "cost",
    description: "Limita 30 requisições/minuto por usuário autenticado.",
    rationale: "Defesa contra abuso e DDoS. Ajuste conforme tier do usuário (free vs pro).",
    severity: "block",
    config: { max_requests_per_minute: 30, scope: "per_user", action: "block" },
    tags: ["Rate Limit", "Abuso"],
    popularity: 5,
  },
];

export const PRESET_CATEGORIES: { id: GuardrailPresetCategory; label: string; icon: string; color: string }[] = [
  { id: "pii", label: "Dados Pessoais", icon: "🔒", color: "text-nexus-rose" },
  { id: "injection", label: "Anti-Injection", icon: "🛡️", color: "text-destructive" },
  { id: "safety", label: "Segurança de Conteúdo", icon: "⚠️", color: "text-nexus-amber" },
  { id: "compliance", label: "Conformidade", icon: "⚖️", color: "text-primary" },
  { id: "quality", label: "Qualidade", icon: "✨", color: "text-nexus-emerald" },
  { id: "cost", label: "Controle de Custo", icon: "💰", color: "text-nexus-cyan" },
];

export function presetsByCategory(category: GuardrailPresetCategory): GuardrailPreset[] {
  return GUARDRAIL_PRESETS.filter(p => p.category === category);
}
