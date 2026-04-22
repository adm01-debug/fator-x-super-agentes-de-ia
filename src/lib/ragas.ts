/**
 * RAGAS — `src/lib/ragas.ts`
 *
 * Métricas-chave do framework RAGAS para avaliação de pipelines RAG:
 *
 *   faithfulness       — a resposta é sustentada pelo contexto recuperado?
 *   answer_relevancy   — a resposta endereça a pergunta do usuário?
 *   context_precision  — dos chunks recuperados, quantos são relevantes?
 *   context_recall     — dos pontos da resposta esperada, quantos estão nos chunks?
 *
 * Implementação é heurística (sem chamada a LLM) — combina overlap de
 * tokens com Jaccard e ROUGE-L. Para maior fidelidade, o edge
 * `eval-judge` pode refinar os scores usando LLM-as-judge.
 *
 * Ref: RAGAS paper (Shahul et al, 2023). Implementação simplificada.
 */

export interface RagasInput {
  question: string;
  answer: string;
  contexts: string[]; // chunks recuperados via RAG
  ground_truth?: string; // resposta esperada (quando disponível)
}

export interface RagasScores {
  faithfulness: number; // 0..1 — answer é sustentado pelo contexto
  answer_relevancy: number; // 0..1 — answer responde a question
  context_precision: number; // 0..1 — chunks recuperados são relevantes
  context_recall: number | null; // 0..1 — só se ground_truth existir
  overall: number; // média ponderada
}

const STOPWORDS_PT = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'que',
  'um',
  'uma',
  'para',
  'com',
  'por',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'se',
  'the',
  'is',
  'of',
  'and',
  'to',
  'in',
  'for',
  'on',
  'at',
  'are',
  'ou',
  'ao',
  'à',
  'como',
  'mais',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS_PT.has(t));
}

function toTokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Sentence-split PT/EN: quebra em frases curtas. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

// ═══ Faithfulness ══════════════════════════════════════════════
// Para cada sentença da resposta, medir overlap com a união dos contextos.
// Score = média do overlap Jaccard.

export function faithfulness(answer: string, contexts: string[]): number {
  if (!answer || contexts.length === 0) return 0;
  const contextTokens = new Set<string>();
  for (const c of contexts) toTokenSet(c).forEach((t) => contextTokens.add(t));

  const answerSentences = sentences(answer);
  if (answerSentences.length === 0) return 0;

  const scores = answerSentences.map((s) => jaccard(toTokenSet(s), contextTokens));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ═══ Answer Relevancy ══════════════════════════════════════════
// Jaccard entre tokens da pergunta e tokens da resposta (stopwords removidas).

export function answerRelevancy(question: string, answer: string): number {
  return jaccard(toTokenSet(question), toTokenSet(answer));
}

// ═══ Context Precision ═════════════════════════════════════════
// % dos chunks recuperados que têm overlap ≥ threshold com a pergunta.

export function contextPrecision(question: string, contexts: string[], threshold = 0.05): number {
  if (contexts.length === 0) return 0;
  const q = toTokenSet(question);
  const relevant = contexts.filter((c) => jaccard(q, toTokenSet(c)) >= threshold).length;
  return relevant / contexts.length;
}

// ═══ Context Recall ════════════════════════════════════════════
// Jaccard(ground_truth tokens, union dos contextos tokens).

export function contextRecall(groundTruth: string, contexts: string[]): number {
  if (!groundTruth || contexts.length === 0) return 0;
  const ctxTokens = new Set<string>();
  for (const c of contexts) toTokenSet(c).forEach((t) => ctxTokens.add(t));
  return jaccard(toTokenSet(groundTruth), ctxTokens);
}

// ═══ All-in-one ════════════════════════════════════════════════

export function scoreRagas(input: RagasInput): RagasScores {
  const f = faithfulness(input.answer, input.contexts);
  const ar = answerRelevancy(input.question, input.answer);
  const cp = contextPrecision(input.question, input.contexts);
  const cr =
    input.ground_truth !== undefined ? contextRecall(input.ground_truth, input.contexts) : null;

  // pesos clássicos RAGAS: faithfulness é o mais importante
  const parts = [
    { value: f, weight: 0.4 },
    { value: ar, weight: 0.25 },
    { value: cp, weight: 0.2 },
    ...(cr !== null ? [{ value: cr, weight: 0.15 }] : []),
  ];
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const overall =
    totalWeight > 0 ? parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight : 0;

  return {
    faithfulness: round(f),
    answer_relevancy: round(ar),
    context_precision: round(cp),
    context_recall: cr === null ? null : round(cr),
    overall: round(overall),
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ═══ Verdict helper para uso em eval gates ═════════════════════
export interface RagasVerdict {
  passes: boolean;
  scores: RagasScores;
  failures: string[]; // quais métricas ficaram abaixo do threshold
}

export const DEFAULT_RAGAS_THRESHOLDS = {
  faithfulness: 0.35,
  answer_relevancy: 0.2,
  context_precision: 0.25,
  context_recall: 0.2,
};

export function evaluateRagas(
  input: RagasInput,
  thresholds: Partial<typeof DEFAULT_RAGAS_THRESHOLDS> = {},
): RagasVerdict {
  const t = { ...DEFAULT_RAGAS_THRESHOLDS, ...thresholds };
  const scores = scoreRagas(input);
  const failures: string[] = [];
  if (scores.faithfulness < t.faithfulness) failures.push('faithfulness');
  if (scores.answer_relevancy < t.answer_relevancy) failures.push('answer_relevancy');
  if (scores.context_precision < t.context_precision) failures.push('context_precision');
  if (scores.context_recall !== null && scores.context_recall < t.context_recall) {
    failures.push('context_recall');
  }
  return { passes: failures.length === 0, scores, failures };
}
