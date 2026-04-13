import type { NotificationChannel } from '../types/notificationTypes';

export const NOTIFICATION_PRESETS: Record<
  string,
  { subject: string; body: string; channel: NotificationChannel; category: string }
> = {
  deal_approved: {
    subject: '✅ Orçamento #{{deal_id}} aprovado pelo cliente',
    body: 'O cliente {{client_name}} aprovou o orçamento #{{deal_id}} no valor de R$ {{amount}}. Próximo passo: enviar pedido para Compras.',
    channel: 'whatsapp', category: 'vendas',
  },
  purchase_order: {
    subject: '📦 Novo pedido de compra #{{po_number}}',
    body: 'Pedido de compra #{{po_number}} criado por {{requester}}. Fornecedor: {{supplier}}. Valor: R$ {{amount}}. Prazo: {{deadline}}.',
    channel: 'email', category: 'compras',
  },
  delivery_update: {
    subject: '🚚 Atualização de entrega - Pedido #{{order_id}}',
    body: 'Pedido #{{order_id}} do cliente {{client_name}}: {{tracking_status}}. Previsão: {{estimated_delivery}}.',
    channel: 'whatsapp', category: 'logistica',
  },
  art_approval: {
    subject: '🎨 Arte aguardando aprovação - Job #{{job_id}}',
    body: 'A arte do job #{{job_id}} ({{product_name}}) está pronta para aprovação. Cliente: {{client_name}}. Link: {{preview_link}}.',
    channel: 'in_app', category: 'arte',
  },
  payment_received: {
    subject: '💰 Pagamento recebido - NF #{{invoice_number}}',
    body: 'Pagamento de R$ {{amount}} recebido referente à NF #{{invoice_number}}. Cliente: {{client_name}}. Método: {{payment_method}}.',
    channel: 'slack', category: 'financeiro',
  },
  overdue_invoice: {
    subject: '⚠️ Fatura vencida - NF #{{invoice_number}}',
    body: 'A NF #{{invoice_number}} do cliente {{client_name}} venceu em {{due_date}}. Valor: R$ {{amount}}. Dias em atraso: {{days_overdue}}.',
    channel: 'email', category: 'financeiro',
  },
  agent_error: {
    subject: '🔴 Erro no agente {{agent_name}}',
    body: 'O agente {{agent_name}} falhou ao executar a tarefa "{{task_name}}". Erro: {{error_message}}. Tentativas: {{retry_count}}/{{max_retries}}.',
    channel: 'slack', category: 'sistema',
  },
  workflow_completed: {
    subject: '✅ Workflow "{{workflow_name}}" concluído',
    body: 'O workflow "{{workflow_name}}" foi concluído com sucesso em {{duration}}. Resultado: {{result_summary}}.',
    channel: 'in_app', category: 'sistema',
  },
};
