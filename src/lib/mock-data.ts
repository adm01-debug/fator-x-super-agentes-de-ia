// Re-export barrel — mantém compatibilidade com imports existentes
// Cada módulo agora está em arquivo separado para melhor tree-shaking
export { agents, type Agent } from './mock-data/agents';
export { alerts, activities, type Alert, type Activity } from './mock-data/alerts';
export { knowledgeBases, type KnowledgeBase } from './mock-data/knowledge';
export { tools, type ToolIntegration } from './mock-data/tools';
export { evaluations, type EvaluationRun } from './mock-data/evaluations';
export { traces, type SessionTrace, type TraceStep } from './mock-data/monitoring';
export { deployments, type Deployment } from './mock-data/deployments';
export { teamMembers, type TeamMember } from './mock-data/team';
export { guardrails, type GuardrailPolicy } from './mock-data/security';
export { costByModelData, sessionsPerDayData, latencyByAgentData, errorRateData, usageBreakdown } from './mock-data/charts';
