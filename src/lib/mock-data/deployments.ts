export interface Deployment { id: string; agent: string; channel: string; environment: 'development' | 'staging' | 'production'; status: 'active' | 'inactive' | 'deploying'; version: string; traffic: number; lastDeployed: string; }

export const deployments: Deployment[] = [
  { id: '1', agent: 'Atlas — Atendimento Premium', channel: 'Widget de Chat', environment: 'production', status: 'active', version: 'v2.4', traffic: 100, lastDeployed: '2026-03-28 14:00' },
  { id: '2', agent: 'Atlas — Atendimento Premium', channel: 'API Endpoint', environment: 'production', status: 'active', version: 'v2.4', traffic: 100, lastDeployed: '2026-03-28 14:00' },
  { id: '3', agent: 'Cleo — SDR Inteligente', channel: 'API Endpoint', environment: 'production', status: 'active', version: 'v1.8', traffic: 80, lastDeployed: '2026-03-25 10:00' },
  { id: '4', agent: 'Cleo — SDR Inteligente', channel: 'Slack Bot', environment: 'staging', status: 'active', version: 'v1.9-beta', traffic: 20, lastDeployed: '2026-03-29 16:00' },
  { id: '5', agent: 'Scout — Pesquisador de Mercado', channel: 'Web App Embed', environment: 'production', status: 'active', version: 'v1.2', traffic: 100, lastDeployed: '2026-03-20 09:00' },
  { id: '6', agent: 'Sentinel — Compliance Analyst', channel: 'Internal Assistant', environment: 'staging', status: 'deploying', version: 'v0.9', traffic: 0, lastDeployed: '2026-03-30 09:45' },
];
