export interface EvaluationRun { id: string; name: string; agent: string; status: 'completed' | 'running' | 'failed' | 'queued'; factuality: number; groundedness: number; taskSuccess: number; hallucinationRisk: number; latencyAvg: number; costTotal: number; testCases: number; passRate: number; createdAt: string; }

export const evaluations: EvaluationRun[] = [
  { id: '1', name: 'Atlas v2.4 — Regressão Completa', agent: 'Atlas — Atendimento Premium', status: 'completed', factuality: 94.2, groundedness: 91.8, taskSuccess: 88.5, hallucinationRisk: 3.2, latencyAvg: 1.9, costTotal: 12.40, testCases: 250, passRate: 92.4, createdAt: '2026-03-30 06:00' },
  { id: '2', name: 'Scout — Benchmark Q1', agent: 'Scout — Pesquisador de Mercado', status: 'completed', factuality: 87.5, groundedness: 85.2, taskSuccess: 82.0, hallucinationRisk: 8.1, latencyAvg: 3.4, costTotal: 8.90, testCases: 120, passRate: 85.0, createdAt: '2026-03-29 14:00' },
  { id: '3', name: 'Cleo — Adversarial Test', agent: 'Cleo — SDR Inteligente', status: 'running', factuality: 0, groundedness: 0, taskSuccess: 0, hallucinationRisk: 0, latencyAvg: 0, costTotal: 0, testCases: 80, passRate: 0, createdAt: '2026-03-30 09:30' },
  { id: '4', name: 'Sentinel — Compliance Audit', agent: 'Sentinel — Compliance Analyst', status: 'completed', factuality: 97.1, groundedness: 96.5, taskSuccess: 94.0, hallucinationRisk: 1.5, latencyAvg: 4.8, costTotal: 15.20, testCases: 180, passRate: 96.1, createdAt: '2026-03-28 10:00' },
];
