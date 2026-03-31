export const costByModelData = [
  { name: 'GPT-4o', cost: 78.10, color: 'hsl(250, 80%, 65%)' },
  { name: 'Claude 3.5', cost: 47.40, color: 'hsl(185, 80%, 60%)' },
  { name: 'Gemini 1.5', cost: 12.80, color: 'hsl(160, 70%, 50%)' },
  { name: 'Embeddings', cost: 8.50, color: 'hsl(38, 92%, 60%)' },
];

export const sessionsPerDayData = [
  { day: 'Seg', sessions: 1850 }, { day: 'Ter', sessions: 2100 }, { day: 'Qua', sessions: 1920 },
  { day: 'Qui', sessions: 2340 }, { day: 'Sex', sessions: 2580 }, { day: 'Sáb', sessions: 980 }, { day: 'Dom', sessions: 720 },
];

export const latencyByAgentData = [
  { agent: 'Atlas', p50: 1.2, p95: 2.8, p99: 4.1 }, { agent: 'Scout', p50: 2.1, p95: 4.5, p99: 7.2 },
  { agent: 'Cleo', p50: 1.5, p95: 3.2, p99: 5.0 }, { agent: 'Sentinel', p50: 3.0, p95: 6.1, p99: 9.8 },
  { agent: 'Nova', p50: 3.5, p95: 7.0, p99: 12.0 },
];

export const errorRateData = [
  { hour: '00h', rate: 1.2 }, { hour: '02h', rate: 0.8 }, { hour: '04h', rate: 0.5 },
  { hour: '06h', rate: 1.0 }, { hour: '08h', rate: 2.1 }, { hour: '10h', rate: 3.8 },
  { hour: '12h', rate: 2.5 }, { hour: '14h', rate: 1.8 }, { hour: '16h', rate: 2.2 },
  { hour: '18h', rate: 1.5 }, { hour: '20h', rate: 1.1 }, { hour: '22h', rate: 0.9 },
];

export const usageBreakdown = {
  totalCost: 146.80,
  tokens: { input: 1695000, output: 1045000, cost: 98.50 },
  embeddings: { vectors: 32150, cost: 8.50 },
  storage: { gb: 12.4, cost: 6.20 },
  toolCalls: { count: 5243, cost: 26.10 },
  compute: { hours: 3.2, cost: 7.50 },
};
