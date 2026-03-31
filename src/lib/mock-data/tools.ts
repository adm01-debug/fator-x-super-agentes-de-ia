export interface ToolIntegration { id: string; name: string; category: string; icon: string; status: 'connected' | 'disconnected' | 'error'; rateLimit: string; lastUsed: string; callsToday: number; }

export const tools: ToolIntegration[] = [
  { id: '1', name: 'Web Search', category: 'Pesquisa', icon: 'Search', status: 'connected', rateLimit: '100/min', lastUsed: '1 min atrás', callsToday: 2340 },
  { id: '2', name: 'Browser', category: 'Pesquisa', icon: 'Globe', status: 'connected', rateLimit: '30/min', lastUsed: '5 min atrás', callsToday: 456 },
  { id: '3', name: 'Code Execution', category: 'Desenvolvimento', icon: 'Code', status: 'error', rateLimit: '50/min', lastUsed: '2 min atrás', callsToday: 890 },
  { id: '4', name: 'SQL Query', category: 'Dados', icon: 'Database', status: 'connected', rateLimit: '200/min', lastUsed: '8 min atrás', callsToday: 1560 },
  { id: '5', name: 'Salesforce CRM', category: 'CRM', icon: 'Users', status: 'connected', rateLimit: '60/min', lastUsed: '3 min atrás', callsToday: 780 },
  { id: '6', name: 'Gmail', category: 'Comunicação', icon: 'Mail', status: 'connected', rateLimit: '50/min', lastUsed: '12 min atrás', callsToday: 234 },
  { id: '7', name: 'Google Calendar', category: 'Produtividade', icon: 'Calendar', status: 'connected', rateLimit: '30/min', lastUsed: '25 min atrás', callsToday: 89 },
  { id: '8', name: 'Slack', category: 'Comunicação', icon: 'MessageSquare', status: 'connected', rateLimit: '40/min', lastUsed: '1 min atrás', callsToday: 1120 },
  { id: '9', name: 'Notion', category: 'Produtividade', icon: 'FileText', status: 'disconnected', rateLimit: '—', lastUsed: 'Nunca', callsToday: 0 },
  { id: '10', name: 'Webhook', category: 'Custom', icon: 'Webhook', status: 'connected', rateLimit: '100/min', lastUsed: '15 min atrás', callsToday: 345 },
  { id: '11', name: 'Custom API', category: 'Custom', icon: 'Plug', status: 'disconnected', rateLimit: '—', lastUsed: 'Nunca', callsToday: 0 },
  { id: '12', name: 'Human Handoff', category: 'Operações', icon: 'UserCheck', status: 'connected', rateLimit: '—', lastUsed: '45 min atrás', callsToday: 23 },
];
