import type { AgentConfig } from '@/types/agentTypes';

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  tabId: string;
}

export interface ReadinessResult {
  score: number; // 0-10
  passed: number;
  total: number;
  checks: ReadinessCheck[];
  missing: ReadinessCheck[];
  level: 'critical' | 'warning' | 'good' | 'excellent';
}

export function computeReadinessScore(agent: AgentConfig): ReadinessResult {
  const checks: ReadinessCheck[] = [
    {
      id: 'name',
      label: 'Nome do agente definido',
      passed: !!agent.name?.trim(),
      tabId: 'identity',
    },
    {
      id: 'mission',
      label: 'Missão descrita',
      passed: !!agent.mission && agent.mission.length >= 20,
      tabId: 'identity',
    },
    { id: 'persona', label: 'Persona configurada', passed: !!agent.persona, tabId: 'identity' },
    { id: 'model', label: 'Modelo selecionado', passed: !!agent.model, tabId: 'brain' },
    {
      id: 'system_prompt',
      label: 'System prompt ≥ 200 caracteres',
      passed: (agent.system_prompt?.length ?? 0) >= 200,
      tabId: 'prompt',
    },
    {
      id: 'tools',
      label: '≥ 1 ferramenta ativa',
      passed: (agent.tools ?? []).some((t) => t.enabled),
      tabId: 'tools',
    },
    {
      id: 'guardrails',
      label: '≥ 1 guardrail ativo',
      passed: (agent.guardrails ?? []).some((g) => g.enabled),
      tabId: 'guardrails',
    },
    {
      id: 'tests',
      label: '≥ 1 caso de teste',
      passed: (agent.test_cases ?? []).length >= 1,
      tabId: 'testing',
    },
    {
      id: 'observability',
      label: 'Logging habilitado',
      passed: !!agent.logging_enabled,
      tabId: 'observability',
    },
    {
      id: 'deploy',
      label: 'Canal de deploy configurado',
      passed:
        (((agent as Record<string, unknown>).deploy_channels as unknown[]) ?? []).length > 0 ||
        !!(agent as Record<string, unknown>).deploy_channel,
      tabId: 'deploy',
    },
  ];

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 10);
  const missing = checks.filter((c) => !c.passed);

  let level: ReadinessResult['level'] = 'critical';
  if (score >= 9) level = 'excellent';
  else if (score >= 7) level = 'good';
  else if (score >= 5) level = 'warning';

  return { score, passed, total, checks, missing, level };
}

export const READINESS_COLORS: Record<
  ReadinessResult['level'],
  { bg: string; text: string; border: string; label: string }
> = {
  critical: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/40',
    label: 'Crítico',
  },
  warning: {
    bg: 'bg-nexus-amber/10',
    text: 'text-nexus-amber',
    border: 'border-nexus-amber/40',
    label: 'Em progresso',
  },
  good: {
    bg: 'bg-nexus-emerald/10',
    text: 'text-nexus-emerald',
    border: 'border-nexus-emerald/40',
    label: 'Quase lá',
  },
  excellent: {
    bg: 'bg-nexus-emerald/15',
    text: 'text-nexus-emerald',
    border: 'border-nexus-emerald/60',
    label: 'Pronto',
  },
};
