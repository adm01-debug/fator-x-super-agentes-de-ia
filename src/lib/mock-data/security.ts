export interface GuardrailPolicy { id: string; name: string; type: string; status: 'active' | 'inactive' | 'testing'; description: string; triggersToday: number; blockRate: number; }

export const guardrails: GuardrailPolicy[] = [
  { id: '1', name: 'PII Masking', type: 'Privacidade', status: 'active', description: 'Detecta e mascara CPF, email, telefone e endereço nas respostas', triggersToday: 145, blockRate: 99.2 },
  { id: '2', name: 'Content Moderation', type: 'Segurança', status: 'active', description: 'Filtra conteúdo ofensivo, violento ou discriminatório', triggersToday: 23, blockRate: 97.8 },
  { id: '3', name: 'Jailbreak Detection', type: 'Segurança', status: 'active', description: 'Identifica tentativas de prompt injection e jailbreak', triggersToday: 8, blockRate: 95.5 },
  { id: '4', name: 'Cost Limiter', type: 'Custo', status: 'active', description: 'Bloqueia execuções que excedam R$ 5,00 por sessão', triggersToday: 3, blockRate: 100 },
  { id: '5', name: 'Token Limit', type: 'Custo', status: 'active', description: 'Limita output a 4.096 tokens por resposta', triggersToday: 67, blockRate: 100 },
  { id: '6', name: 'JSON Schema Validation', type: 'Qualidade', status: 'active', description: 'Valida saída estruturada contra schema definido', triggersToday: 12, blockRate: 100 },
  { id: '7', name: 'Human Approval Gate', type: 'Governança', status: 'testing', description: 'Requer aprovação humana para ações críticas', triggersToday: 5, blockRate: 100 },
  { id: '8', name: 'Allow/Deny Tool List', type: 'Segurança', status: 'active', description: 'Controla quais ferramentas cada agente pode utilizar', triggersToday: 0, blockRate: 100 },
];
