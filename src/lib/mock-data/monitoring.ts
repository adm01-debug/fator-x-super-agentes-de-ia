export interface TraceStep { id: string; type: 'input' | 'retrieval' | 'tool_call' | 'model' | 'guardrail' | 'output'; label: string; duration: number; status: 'success' | 'error'; detail?: string; }
export interface SessionTrace { id: string; sessionId: string; agent: string; user: string; status: 'success' | 'error' | 'timeout'; duration: number; tokens: number; cost: number; toolCalls: number; timestamp: string; steps: TraceStep[]; }

export const traces: SessionTrace[] = [
  { id: '1', sessionId: 'sess_a1b2c3', agent: 'Atlas — Atendimento Premium', user: 'cliente@empresa.com', status: 'success', duration: 2400, tokens: 3200, cost: 0.034, toolCalls: 2, timestamp: '2026-03-30 10:42', steps: [
    { id: 's1', type: 'input', label: 'Mensagem do usuário', duration: 0, status: 'success', detail: '"Como faço para integrar a API de pagamentos?"' },
    { id: 's2', type: 'retrieval', label: 'Busca na base técnica', duration: 180, status: 'success', detail: '5 chunks recuperados, score médio 0.89' },
    { id: 's3', type: 'model', label: 'GPT-4o — geração', duration: 1800, status: 'success', detail: '1,240 tokens gerados' },
    { id: 's4', type: 'guardrail', label: 'PII check', duration: 45, status: 'success', detail: 'Nenhum dado sensível detectado' },
    { id: 's5', type: 'output', label: 'Resposta final', duration: 10, status: 'success', detail: 'Guia passo a passo com link da doc' },
  ]},
  { id: '2', sessionId: 'sess_d4e5f6', agent: 'Cleo — SDR Inteligente', user: 'lead@prospect.io', status: 'success', duration: 5200, tokens: 4800, cost: 0.052, toolCalls: 4, timestamp: '2026-03-30 10:38', steps: [
    { id: 's1', type: 'input', label: 'Trigger: novo lead', duration: 0, status: 'success' },
    { id: 's2', type: 'tool_call', label: 'CRM — buscar perfil', duration: 320, status: 'success' },
    { id: 's3', type: 'tool_call', label: 'Web Search — empresa', duration: 890, status: 'success' },
    { id: 's4', type: 'model', label: 'GPT-4o — gerar email', duration: 2100, status: 'success' },
    { id: 's5', type: 'tool_call', label: 'Gmail — enviar', duration: 450, status: 'success' },
    { id: 's6', type: 'tool_call', label: 'CRM — registrar atividade', duration: 280, status: 'success' },
    { id: 's7', type: 'output', label: 'Email enviado', duration: 10, status: 'success' },
  ]},
  { id: '3', sessionId: 'sess_g7h8i9', agent: 'Nova — Copiloto Dev', user: 'dev@team.com', status: 'error', duration: 8500, tokens: 6200, cost: 0.089, toolCalls: 3, timestamp: '2026-03-30 10:35', steps: [
    { id: 's1', type: 'input', label: 'Pedido de debug', duration: 0, status: 'success' },
    { id: 's2', type: 'retrieval', label: 'Busca na doc de código', duration: 220, status: 'success' },
    { id: 's3', type: 'tool_call', label: 'Code execution — análise', duration: 3200, status: 'error', detail: 'Timeout após 30s' },
    { id: 's4', type: 'model', label: 'Claude 3.5 — retry', duration: 2800, status: 'success' },
    { id: 's5', type: 'tool_call', label: 'Code execution — retry', duration: 0, status: 'error', detail: 'Sandbox indisponível' },
  ]},
];
