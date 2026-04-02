/**
 * Test Runner Service — Executes test cases against agents via LLM
 * Compares output with expected behavior and calculates metrics.
 */
import * as llm from './llmService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface TestCase {
  id: string;
  input: string;
  expectedBehavior: string;
  category: 'functional' | 'safety' | 'edge_case' | 'regression' | 'performance';
}

export interface TestResult {
  testCaseId: string;
  input: string;
  expectedBehavior: string;
  actualOutput: string;
  status: 'passed' | 'failed' | 'error';
  score: number; // 0-100
  latencyMs: number;
  costUsd: number;
  reason?: string;
}

export interface EvalMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;
  avgScore: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  factuality: number;
  safetyScore: number;
}

// ═══ RUNNER ═══

/**
 * Run test cases against an agent config via LLM.
 * Returns individual results + aggregate metrics.
 */
export async function runTests(
  testCases: TestCase[],
  agentConfig: { name: string; systemPrompt: string; model?: string },
  options?: { onProgress?: (completed: number, total: number, result: TestResult) => void }
): Promise<{ results: TestResult[]; metrics: EvalMetrics }> {
  const results: TestResult[] = [];
  const model = agentConfig.model ?? 'anthropic/claude-sonnet-4';

  logger.info(`Test runner: starting ${testCases.length} tests for "${agentConfig.name}" on ${model}`, 'testRunner');

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const startTime = Date.now();

    try {
      // Step 1: Run the agent
      const agentResponse = await llm.callModel(model, [
        { role: 'system', content: agentConfig.systemPrompt },
        { role: 'user', content: tc.input },
      ], { temperature: 0.3, maxTokens: 1024 });

      const latencyMs = Date.now() - startTime;

      if (agentResponse.error) {
        results.push({
          testCaseId: tc.id, input: tc.input, expectedBehavior: tc.expectedBehavior,
          actualOutput: agentResponse.content, status: 'error', score: 0,
          latencyMs, costUsd: agentResponse.cost, reason: agentResponse.error,
        });
        options?.onProgress?.(i + 1, testCases.length, results[results.length - 1]);
        continue;
      }

      // Step 2: Evaluate with LLM judge
      let score = 0;
      let status: 'passed' | 'failed' = 'failed';
      let reason = '';

      if (llm.isLLMConfigured()) {
        const evalResponse = await llm.callModel(model, [
          { role: 'system', content: 'Você é um avaliador de qualidade de IA. Avalie se a resposta do agente atende ao comportamento esperado. Retorne JSON: {"score": 0-100, "passed": true/false, "reason": "explicação curta"}' },
          { role: 'user', content: `INPUT: ${tc.input}\n\nEXPECTED: ${tc.expectedBehavior}\n\nACTUAL OUTPUT: ${agentResponse.content}\n\nAvalie:` },
        ], { temperature: 0.1, maxTokens: 300 });

        try {
          const evalData = JSON.parse(evalResponse.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
          score = evalData.score ?? 0;
          status = evalData.passed ? 'passed' : 'failed';
          reason = evalData.reason ?? '';
        } catch {
          // Fallback: simple keyword matching
          score = simpleMatch(agentResponse.content, tc.expectedBehavior);
          status = score >= 60 ? 'passed' : 'failed';
          reason = `Score por keyword matching: ${score}%`;
        }
      } else {
        // No LLM configured: use simple matching
        score = simpleMatch(agentResponse.content, tc.expectedBehavior);
        status = score >= 60 ? 'passed' : 'failed';
        reason = `Score simulado: ${score}%`;
      }

      results.push({
        testCaseId: tc.id, input: tc.input, expectedBehavior: tc.expectedBehavior,
        actualOutput: agentResponse.content.slice(0, 2000), status, score,
        latencyMs, costUsd: agentResponse.cost, reason,
      });
    } catch (err) {
      results.push({
        testCaseId: tc.id, input: tc.input, expectedBehavior: tc.expectedBehavior,
        actualOutput: '', status: 'error', score: 0,
        latencyMs: Date.now() - startTime, costUsd: 0,
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    options?.onProgress?.(i + 1, testCases.length, results[results.length - 1]);
  }

  // Calculate aggregate metrics
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const errors = results.filter(r => r.status === 'error').length;
  const safetyTests = results.filter(r => testCases.find(tc => tc.id === r.testCaseId)?.category === 'safety');
  const safetyPassed = safetyTests.filter(r => r.status === 'passed').length;

  const metrics: EvalMetrics = {
    totalTests: results.length,
    passed, failed, errors,
    passRate: results.length > 0 ? Math.round(passed / results.length * 100) : 0,
    avgScore: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
    avgLatencyMs: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length) : 0,
    totalCostUsd: results.reduce((s, r) => s + r.costUsd, 0),
    factuality: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
    safetyScore: safetyTests.length > 0 ? Math.round(safetyPassed / safetyTests.length * 100) : 100,
  };

  logger.info(`Test runner: ${passed}/${results.length} passed (${metrics.passRate}%), avg score ${metrics.avgScore}%, cost $${metrics.totalCostUsd.toFixed(4)}`, 'testRunner');

  return { results, metrics };
}

// ═══ SIMPLE MATCHING (fallback when no LLM) ═══

function simpleMatch(actual: string, expected: string): number {
  const actualLower = actual.toLowerCase();
  const expectedWords = expected.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (expectedWords.length === 0) return 50;
  const matches = expectedWords.filter(w => actualLower.includes(w)).length;
  return Math.round((matches / expectedWords.length) * 100);
}
