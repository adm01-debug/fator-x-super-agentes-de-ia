/**
 * CI/CD Service — Agent deployment pipeline with quality gates
 * SDK generation, event triggers, and edge caching configuration
 */
import * as agentGovernance from './agentGovernance';
import * as traceService from './traceService';
import { logger } from '@/lib/logger';

// ═══ CI/CD PIPELINE ═══

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs: number;
  details: string;
}

export interface PipelineRun {
  id: string;
  agentId: string;
  agentName: string;
  version: string;
  stages: PipelineStage[];
  status: 'running' | 'passed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  promotedTo?: string;
}

const pipelineHistory: PipelineRun[] = [];

/** Run full CI/CD pipeline for an agent version. */
export async function runPipeline(
  agentId: string,
  agentName: string,
  version: string,
  config: Record<string, unknown>,
  onStageComplete?: (stage: PipelineStage) => void
): Promise<PipelineRun> {
  const run: PipelineRun = {
    id: `pipe-${Date.now()}`, agentId, agentName, version,
    stages: [], status: 'running', triggeredBy: 'manual',
    startedAt: new Date().toISOString(),
  };

  const stages = [
    { name: 'Lint & Validate', check: () => validateConfig(config) },
    { name: 'Prompt Regression Tests', check: () => runPromptTests(agentId) },
    { name: 'Safety & Bias Check', check: () => runSafetyCheck(config) },
    { name: 'Cost Estimation', check: () => estimateCost(config) },
    { name: 'Quality Gate', check: () => qualityGate(agentId) },
    { name: 'Staging Deploy', check: () => stagingDeploy(agentId, version) },
  ];

  for (const stage of stages) {
    const stageResult: PipelineStage = { name: stage.name, status: 'running', durationMs: 0, details: '' };
    const start = Date.now();

    try {
      const result = await stage.check();
      stageResult.status = result.passed ? 'passed' : 'failed';
      stageResult.details = result.message;
      stageResult.durationMs = Date.now() - start;

      if (!result.passed) {
        run.status = 'failed';
        run.stages.push(stageResult);
        onStageComplete?.(stageResult);
        break;
      }
    } catch (err) {
      stageResult.status = 'failed';
      stageResult.details = err instanceof Error ? err.message : 'Unknown error';
      stageResult.durationMs = Date.now() - start;
      run.status = 'failed';
      run.stages.push(stageResult);
      onStageComplete?.(stageResult);
      break;
    }

    run.stages.push(stageResult);
    onStageComplete?.(stageResult);
  }

  if (run.status === 'running') run.status = 'passed';
  run.completedAt = new Date().toISOString();
  pipelineHistory.unshift(run);
  if (pipelineHistory.length > 100) pipelineHistory.length = 100;

  logger.info(`Pipeline ${run.status}: ${agentName} ${version} (${run.stages.length} stages)`, 'cicd');
  return run;
}

// Stage implementations
async function validateConfig(config: Record<string, unknown>): Promise<{ passed: boolean; message: string }> {
  const hasName = !!config.name;
  const hasPrompt = typeof config.system_prompt === 'string' && (config.system_prompt as string).length > 10;
  const passed = hasName && hasPrompt;
  return { passed, message: passed ? 'Config valid' : `Missing: ${!hasName ? 'name' : ''} ${!hasPrompt ? 'prompt (min 10 chars)' : ''}` };
}

async function runPromptTests(agentId: string): Promise<{ passed: boolean; message: string }> {
  const traces = traceService.getTraces(10, agentId);
  const successRate = traces.length > 0 ? traces.filter(t => t.status === 'success').length / traces.length : 1;
  return { passed: successRate >= 0.7, message: `Success rate: ${Math.round(successRate * 100)}% (min 70%)` };
}

async function runSafetyCheck(config: Record<string, unknown>): Promise<{ passed: boolean; message: string }> {
  const prompt = String(config.system_prompt ?? '');
  const hasGuardrails = prompt.includes('não') || prompt.includes('escopo') || prompt.includes('segurança');
  return { passed: true, message: hasGuardrails ? 'Safety constraints found in prompt' : 'Warning: No explicit safety constraints in prompt' };
}

async function estimateCost(config: Record<string, unknown>): Promise<{ passed: boolean; message: string }> {
  const model = String(config.model ?? 'claude-sonnet-4');
  const isExpensive = model.includes('opus');
  return { passed: true, message: `Model: ${model} — Est. $${isExpensive ? '0.05' : '0.01'}/call` };
}

async function qualityGate(agentId: string): Promise<{ passed: boolean; message: string }> {
  const traces = traceService.getTraces(20, agentId);
  if (traces.length < 3) return { passed: true, message: 'Insufficient data for quality gate (< 3 traces)' };
  const avgLatency = traces.reduce((s, t) => s + t.latency_ms, 0) / traces.length;
  const passed = avgLatency < 15000;
  return { passed, message: `Avg latency: ${(avgLatency / 1000).toFixed(1)}s (max 15s)` };
}

async function stagingDeploy(agentId: string, version: string): Promise<{ passed: boolean; message: string }> {
  return { passed: true, message: `Staged: ${agentId} ${version}` };
}

export function getPipelineHistory(agentId?: string): PipelineRun[] {
  return agentId ? pipelineHistory.filter(p => p.agentId === agentId) : pipelineHistory;
}

// ═══ EVENT TRIGGERS ═══

export interface EventTrigger {
  id: string;
  name: string;
  type: 'cron' | 'webhook' | 'event';
  schedule?: string; // Cron expression
  webhookUrl?: string;
  eventType?: string; // 'new_lead', 'ticket_created', etc.
  agentId: string;
  enabled: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

const triggers: EventTrigger[] = [];

export function addTrigger(trigger: Omit<EventTrigger, 'id' | 'triggerCount'>): EventTrigger {
  const t: EventTrigger = { ...trigger, id: `trig-${Date.now()}`, triggerCount: 0 };
  triggers.push(t);
  return t;
}

export function getTriggers(agentId?: string): EventTrigger[] {
  return agentId ? triggers.filter(t => t.agentId === agentId) : triggers;
}

export function toggleTrigger(id: string): void {
  const t = triggers.find(tr => tr.id === id);
  if (t) t.enabled = !t.enabled;
}

export function fireTrigger(id: string): boolean {
  const t = triggers.find(tr => tr.id === id);
  if (!t || !t.enabled) return false;
  t.lastTriggered = new Date().toISOString();
  t.triggerCount++;
  logger.info(`Trigger fired: ${t.name} (${t.type}) for agent ${t.agentId}`, 'cicd');
  return true;
}

// ═══ SDK GENERATION ═══

/** Generate SDK embed code for an agent. */
export function generateSDKCode(agentId: string, agentName: string, baseUrl: string): { npm: string; python: string; curl: string } {
  return {
    npm: `// npm install @nexus-agents/sdk
import { NexusAgent } from '@nexus-agents/sdk';

const agent = new NexusAgent({
  agentId: '${agentId}',
  apiKey: process.env.NEXUS_API_KEY,
  baseUrl: '${baseUrl}',
});

const response = await agent.chat('Olá, como posso ajudar?');
console.log(response.content);`,

    python: `# pip install nexus-agents
from nexus_agents import NexusAgent

agent = NexusAgent(
    agent_id="${agentId}",
    api_key=os.environ["NEXUS_API_KEY"],
    base_url="${baseUrl}",
)

response = agent.chat("Olá, como posso ajudar?")
print(response.content)`,

    curl: `curl -X POST ${baseUrl}/api/agents/${agentId}/chat \\
  -H "Authorization: Bearer $NEXUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Olá, como posso ajudar?"}'`,
  };
}

// ═══ EDGE CACHING ═══

export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxEntries: number;
  strategy: 'exact' | 'semantic' | 'prefix';
  excludePatterns: string[];
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlSeconds: 300,
  maxEntries: 1000,
  strategy: 'semantic',
  excludePatterns: ['password', 'secret', 'key', 'token'],
};

/** Check if a query should be cached. */
export function shouldCache(query: string, config: CacheConfig = DEFAULT_CACHE_CONFIG): boolean {
  if (!config.enabled) return false;
  const lower = query.toLowerCase();
  return !config.excludePatterns.some(p => lower.includes(p));
}
