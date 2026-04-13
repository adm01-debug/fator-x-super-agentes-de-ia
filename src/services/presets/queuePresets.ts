import type { CreateQueueInput } from '../types/queueManagerTypes';

export const QUEUE_PRESETS: Record<string, CreateQueueInput> = {
  high_priority: { name: 'Alta Prioridade', description: 'Tarefas urgentes — aprovações, alertas, erros críticos', strategy: 'priority', max_concurrency: 10, max_size: 1000, rate_limit_per_second: 20, default_timeout_ms: 10000, default_max_retries: 5 },
  standard: { name: 'Padrão', description: 'Tarefas normais — processamento de pedidos, sincronizações', strategy: 'fifo', max_concurrency: 5, max_size: 5000, rate_limit_per_second: 10, default_timeout_ms: 30000, default_max_retries: 3 },
  bulk_processing: { name: 'Processamento em Massa', description: 'Grandes volumes — importações, migrações, relatórios', strategy: 'fifo', max_concurrency: 3, max_size: 50000, rate_limit_per_second: 5, default_timeout_ms: 120000, default_max_retries: 2 },
  notification: { name: 'Notificações', description: 'Fila de envio de notificações multi-canal', strategy: 'priority', max_concurrency: 8, max_size: 10000, rate_limit_per_second: 15, default_timeout_ms: 15000, default_max_retries: 3 },
};
