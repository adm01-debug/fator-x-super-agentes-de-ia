/**
 * Types for Evaluations Service (CLEAR Framework)
 */

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  rubric?: string;
  tags: string[];
  weight: number;
}

export interface EvalResult {
  test_case_id: string;
  input: string;
  expected: string;
  actual: string;
  scores: {
    deterministic: number;
    statistical: number;
    llm_judge: number;
    combined: number;
  };
  /** RAGAS metrics when contexts are available (optional). */
  ragas?: {
    faithfulness: number;
    answer_relevancy: number;
    context_precision: number;
    context_recall: number | null;
    overall: number;
  } | null;
  latency_ms: number;
  tokens_used: number;
  cost_usd: number;
  status: 'pass' | 'fail' | 'partial';
}

export interface CLEARScore {
  cost: number;
  latency: number;
  efficiency: number;
  assurance: number;
  reliability: number;
  overall: number;
}
