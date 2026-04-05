import type { AgentConfig, ReadinessScore, ReadinessItem } from '@/types/agentTypes';

// ═══════════════════════════════════════════════════════════════════════════════
// Readiness & Completeness — pure functions extracted from agentBuilderStore
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute a simple 0-100 completeness percentage based on whether
 * key fields have been filled in.
 */
export function computeCompleteness(agent: AgentConfig): number {
  let score = 0;
  if (agent.name) score += 10;
  if (agent.mission) score += 10;
  if (agent.model) score += 10;
  if (agent.system_prompt.length > 50) score += 15;
  if (agent.tools.length > 0) score += 10;
  if (agent.guardrails.length > 0) score += 10;
  if (agent.test_cases.length > 0) score += 10;
  if (agent.rag_sources.length > 0) score += 10;
  if (agent.memory_episodic || agent.memory_semantic) score += 10;
  if (agent.logging_enabled) score += 5;
  return Math.min(score, 100);
}

/**
 * Compute a detailed readiness score with per-category breakdown,
 * blockers, recommendations, and maturity level.
 */
export function computeReadinessScore(agent: AgentConfig): ReadinessScore {
  const categories: ReadinessScore['categories'] = {};
  const blockers: string[] = [];
  const recommendations: string[] = [];

  // Identity (max 10)
  const identityItems: ReadinessItem[] = [
    { label: 'Nome definido', passed: !!agent.name, weight: 3, is_blocker: false },
    { label: 'Missão definida', passed: !!agent.mission, weight: 3, is_blocker: false },
    { label: 'Persona selecionada', passed: !!agent.persona, weight: 2, is_blocker: false },
    { label: 'Escopo definido (>50 chars)', passed: agent.scope.length > 50, weight: 2, is_blocker: false, fix_hint: 'Detalhe o escopo com mais de 50 caracteres' },
  ];
  categories.identity = { score: identityItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 10, items: identityItems };
  if (!agent.name) recommendations.push('💡 Defina um nome para o agente (+3 pontos)');
  if (agent.scope.length <= 50) recommendations.push('💡 Detalhe o escopo do agente (+2 pontos)');

  // Brain (max 12)
  const brainItems: ReadinessItem[] = [
    { label: 'Modelo selecionado', passed: !!agent.model, weight: 5, is_blocker: false },
    { label: 'Fallback configurado', passed: !!agent.model_fallback, weight: 3, is_blocker: false },
    { label: 'Raciocínio definido', passed: !!agent.reasoning, weight: 4, is_blocker: false },
  ];
  categories.brain = { score: brainItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: brainItems };
  if (!agent.model_fallback) recommendations.push('💡 Configurar modelo fallback (+3 pontos)');

  // Memory (max 12)
  const longTermCount = [agent.memory_episodic, agent.memory_semantic, agent.memory_procedural, agent.memory_profile, agent.memory_shared].filter(Boolean).length;
  const memoryItems: ReadinessItem[] = [
    { label: 'Short-term ativo', passed: agent.memory_short_term, weight: 3, is_blocker: false },
    { label: '≥2 memórias de longo prazo', passed: longTermCount >= 2, weight: 4, is_blocker: false },
    { label: 'Governança configurada', passed: longTermCount > 0, weight: 3, is_blocker: false },
    { label: 'Consolidação definida', passed: !!agent.memory_consolidation, weight: 2, is_blocker: false },
  ];
  categories.memory = { score: memoryItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: memoryItems };
  if (longTermCount < 2) recommendations.push('💡 Ativar ≥2 memórias de longo prazo (+4 pontos)');

  // RAG (max 12)
  const ragItems: ReadinessItem[] = [
    { label: 'Arquitetura selecionada', passed: !!agent.rag_architecture, weight: 3, is_blocker: false },
    { label: 'Vector DB selecionado', passed: !!agent.rag_vector_db, weight: 3, is_blocker: false },
    { label: '≥1 fonte de conhecimento', passed: agent.rag_sources.length > 0, weight: 3, is_blocker: false },
    { label: 'Reranker ativo', passed: agent.rag_reranker, weight: 1, is_blocker: false },
    { label: 'Hybrid search ativo', passed: agent.rag_hybrid_search, weight: 2, is_blocker: false },
  ];
  categories.rag = { score: ragItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: ragItems };
  if (agent.rag_sources.length === 0) recommendations.push('💡 Adicionar ≥1 fonte de conhecimento (+3 pontos)');

  // Tools (max 8)
  const activeTools = agent.tools.filter(t => t.enabled);
  const allToolsGoverned = activeTools.length > 0 && activeTools.every(t => t.max_calls_per_session > 0);
  const toolsItems: ReadinessItem[] = [
    { label: '≥3 ferramentas ativas', passed: activeTools.length >= 3, weight: 3, is_blocker: false },
    { label: 'Governança configurada em todas', passed: allToolsGoverned, weight: 3, is_blocker: false },
    { label: 'MCP server configurado', passed: agent.mcp_servers.length > 0, weight: 2, is_blocker: false },
  ];
  categories.tools = { score: toolsItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 8, items: toolsItems };

  // Prompt (max 15)
  const activeTechniques = agent.prompt_techniques.filter(t => t.enabled);
  const promptItems: ReadinessItem[] = [
    { label: 'System prompt >200 chars', passed: agent.system_prompt.length > 200, weight: 5, is_blocker: false },
    { label: '≥2 técnicas de prompt ativas', passed: activeTechniques.length >= 2, weight: 3, is_blocker: false },
    { label: '≥2 few-shot examples', passed: agent.few_shot_examples.length >= 2, weight: 4, is_blocker: false },
    { label: 'Output format definido', passed: !!agent.output_format, weight: 3, is_blocker: false },
  ];
  categories.prompt = { score: promptItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 15, items: promptItems };
  if (agent.system_prompt.length <= 200) recommendations.push('💡 Expandir system prompt para >200 chars (+5 pontos)');
  if (agent.few_shot_examples.length < 2) recommendations.push('💡 Adicionar ≥2 exemplos few-shot (+4 pontos)');

  // Guardrails (max 15) — has BLOCKERS
  const activeGuardrails = agent.guardrails.filter(g => g.enabled);
  const hasInjectionGuardrail = activeGuardrails.some(g => g.name.toLowerCase().includes('injection'));
  const hasPiiGuardrail = activeGuardrails.some(g => g.name.toLowerCase().includes('pii'));
  const guardrailItems: ReadinessItem[] = [
    { label: 'Prompt Injection Detection ativo', passed: hasInjectionGuardrail, weight: 5, is_blocker: true, fix_hint: 'Ativar detecção de prompt injection em Guardrails' },
    { label: '≥5 guardrails ativos', passed: activeGuardrails.length >= 5, weight: 4, is_blocker: false },
    { label: 'PII Redaction ativo', passed: hasPiiGuardrail, weight: 3, is_blocker: false },
    { label: 'Audit trail ativo', passed: activeGuardrails.some(g => g.name.toLowerCase().includes('audit')), weight: 3, is_blocker: false },
  ];
  categories.guardrails = { score: guardrailItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 15, items: guardrailItems };
  if (!hasInjectionGuardrail) blockers.push('⛔ Prompt Injection Detection não está ativo');

  // Testing (max 10) — has BLOCKERS
  const testingItems: ReadinessItem[] = [
    { label: '≥3 cenários de teste', passed: agent.test_cases.length >= 3, weight: 4, is_blocker: true, fix_hint: 'Criar pelo menos 3 cenários de teste em Avaliação & Testes' },
    { label: '≥1 bateria executada', passed: !!agent.last_test_results, weight: 3, is_blocker: false },
    { label: 'Accuracy >80%', passed: (agent.last_test_results?.accuracy ?? 0) > 80, weight: 3, is_blocker: false },
  ];
  categories.testing = { score: testingItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 10, items: testingItems };
  if (agent.test_cases.length < 3) blockers.push('⛔ Menos de 3 cenários de teste criados');

  // Observability (max 6) — has BLOCKERS
  const obsItems: ReadinessItem[] = [
    { label: 'Logging ativo', passed: agent.logging_enabled, weight: 3, is_blocker: true, fix_hint: 'Ativar logging em Deploy & Canais' },
    { label: 'Alerting ativo', passed: agent.alerting_enabled, weight: 3, is_blocker: false },
  ];
  categories.observability = { score: obsItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 6, items: obsItems };
  if (!agent.logging_enabled) blockers.push('⛔ Logging não está habilitado');

  // Calculate total
  const total = Object.values(categories).reduce((s, c) => s + c.score, 0);
  const maxTotal = Object.values(categories).reduce((s, c) => s + c.max, 0);
  const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

  // Maturity level
  let maturity_level: ReadinessScore['maturity_level'] = 'prototype';
  if (percentage >= 80 && blockers.length === 0) maturity_level = 'production_ready';
  else if (percentage >= 60) maturity_level = 'staging';
  else if (percentage >= 40) maturity_level = 'tested';

  return { total: percentage, categories, blockers, recommendations, maturity_level };
}
