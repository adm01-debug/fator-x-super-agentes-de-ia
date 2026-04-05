export type AgentLifecycleState = 'draft' | 'testing' | 'staging' | 'production' | 'deprecated' | 'archived';

const VALID_TRANSITIONS: Record<AgentLifecycleState, AgentLifecycleState[]> = {
  draft: ['testing', 'archived'],
  testing: ['draft', 'staging', 'archived'],
  staging: ['testing', 'production', 'archived'],
  production: ['staging', 'deprecated'],
  deprecated: ['archived', 'staging'],
  archived: ['draft'],
};

export function isValidTransition(from: AgentLifecycleState, to: AgentLifecycleState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(current: AgentLifecycleState): AgentLifecycleState[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export function validateTransition(from: AgentLifecycleState, to: AgentLifecycleState): { valid: boolean; error?: string } {
  if (isValidTransition(from, to)) return { valid: true };
  return { valid: false, error: `Transicao invalida: ${from} → ${to}. Transicoes permitidas: ${getAvailableTransitions(from).join(', ')}` };
}
