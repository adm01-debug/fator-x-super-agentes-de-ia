export interface Alert { id: string; type: 'error' | 'warning' | 'info'; title: string; description: string; agentName?: string; timestamp: string; }
export interface Activity { id: string; user: string; action: string; target: string; timestamp: string; }

export const alerts: Alert[] = [
  { id: '1', type: 'error', title: 'Falha em tool calling', description: 'Nova — Copiloto Dev falhou ao executar code_execution 12 vezes nos últimos 30 min', agentName: 'Nova', timestamp: '2 min atrás' },
  { id: '2', type: 'warning', title: 'Custo anômalo detectado', description: 'Cleo — SDR gastou 40% acima da média diária. Verificar loop de chamadas.', agentName: 'Cleo', timestamp: '15 min atrás' },
  { id: '3', type: 'warning', title: 'Contexto excedido', description: 'Scout — Pesquisador atingiu 95% do limite de contexto em 3 sessões', agentName: 'Scout', timestamp: '1h atrás' },
  { id: '4', type: 'info', title: 'Ingestão concluída', description: 'Base "Políticas Internas 2026" indexou 142 documentos com sucesso', timestamp: '2h atrás' },
  { id: '5', type: 'error', title: 'Embedding pipeline falhou', description: 'Erro ao processar lote de 28 arquivos PDF na base "Contratos Q1"', timestamp: '3h atrás' },
];

export const activities: Activity[] = [
  { id: '1', user: 'Marina Costa', action: 'publicou nova versão do', target: 'Atlas — Atendimento Premium v2.4', timestamp: '5 min atrás' },
  { id: '2', user: 'Rafael Mendes', action: 'criou avaliação para', target: 'Scout — Pesquisador de Mercado', timestamp: '22 min atrás' },
  { id: '3', user: 'Juliana Santos', action: 'atualizou prompt do', target: 'Cleo — SDR Inteligente', timestamp: '1h atrás' },
  { id: '4', user: 'Bruno Almeida', action: 'adicionou guardrail PII no', target: 'Sentinel — Compliance Analyst', timestamp: '2h atrás' },
  { id: '5', user: 'Carlos Ferreira', action: 'pausou o agente', target: 'Iris — BI Analyst', timestamp: '3h atrás' },
  { id: '6', user: 'Marina Costa', action: 'conectou ferramenta Slack ao', target: 'Atlas — Atendimento Premium', timestamp: '4h atrás' },
];
