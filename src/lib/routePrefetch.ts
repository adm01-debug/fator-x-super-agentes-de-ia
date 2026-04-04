/** Lazy route prefetch map — call prefetch(path) on hover to preload chunks */

const routeImports: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/DashboardPage'),
  '/agents': () => import('@/pages/AgentsPage'),
  '/agents/new': () => import('@/pages/CreateAgentPage'),
  '/builder': () => import('@/pages/AgentBuilder'),
  '/brain': () => import('@/pages/SuperCerebroPage'),
  '/oracle': () => import('@/pages/OraclePage'),
  '/knowledge': () => import('@/pages/KnowledgePage'),
  '/memory': () => import('@/pages/MemoryPage'),
  '/tools': () => import('@/pages/ToolsPage'),
  '/prompts': () => import('@/pages/PromptsPage'),
  '/workflows': () => import('@/pages/WorkflowsPage'),
  '/evaluations': () => import('@/pages/EvaluationsPage'),
  '/deployments': () => import('@/pages/DeploymentsPage'),
  '/monitoring': () => import('@/pages/MonitoringPage'),
  '/data-storage': () => import('@/pages/DataStoragePage'),
  '/datahub': () => import('@/pages/DataHubPage'),
  '/admin': () => import('@/pages/AdminPage'),
  '/security': () => import('@/pages/SecurityPage'),
  '/lgpd': () => import('@/pages/LGPDCompliancePage'),
  '/approvals': () => import('@/pages/ApprovalQueuePage'),
  '/team': () => import('@/pages/TeamPage'),
  '/billing': () => import('@/pages/BillingPage'),
  '/settings': () => import('@/pages/SettingsPage'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const loader = routeImports[path];
  if (loader) {
    prefetched.add(path);
    loader().catch(() => prefetched.delete(path));
  }
}
