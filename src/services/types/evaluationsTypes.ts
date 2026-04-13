export interface EvalTestCase {
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
