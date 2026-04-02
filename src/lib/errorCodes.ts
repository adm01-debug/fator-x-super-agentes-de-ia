/**
 * Centralized Error Codes — Consistent error handling across the platform
 * Each error has: code, message (pt-BR), httpStatus, severity
 */

export interface AppError {
  code: string;
  message: string;
  httpStatus: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const ERROR_CODES: Record<string, AppError> = {
  // Auth (1xxx)
  AUTH_INVALID_CREDENTIALS: { code: 'E1001', message: 'Email ou senha inválidos', httpStatus: 401, severity: 'medium' },
  AUTH_TOKEN_EXPIRED: { code: 'E1002', message: 'Sessão expirada — faça login novamente', httpStatus: 401, severity: 'low' },
  AUTH_UNAUTHORIZED: { code: 'E1003', message: 'Você não tem permissão para esta ação', httpStatus: 403, severity: 'medium' },
  AUTH_RATE_LIMITED: { code: 'E1004', message: 'Muitas tentativas — aguarde antes de tentar novamente', httpStatus: 429, severity: 'medium' },

  // Agent (2xxx)
  AGENT_NOT_FOUND: { code: 'E2001', message: 'Agente não encontrado', httpStatus: 404, severity: 'low' },
  AGENT_VALIDATION_FAILED: { code: 'E2002', message: 'Configuração do agente inválida', httpStatus: 400, severity: 'medium' },
  AGENT_SAVE_FAILED: { code: 'E2003', message: 'Erro ao salvar agente', httpStatus: 500, severity: 'high' },
  AGENT_DELETE_FAILED: { code: 'E2004', message: 'Erro ao excluir agente', httpStatus: 500, severity: 'high' },
  AGENT_BUDGET_EXCEEDED: { code: 'E2005', message: 'Budget do agente excedido', httpStatus: 402, severity: 'high' },

  // LLM (3xxx)
  LLM_NO_API_KEY: { code: 'E3001', message: 'API key não configurada', httpStatus: 400, severity: 'high' },
  LLM_PROVIDER_ERROR: { code: 'E3002', message: 'Erro do provedor LLM', httpStatus: 502, severity: 'high' },
  LLM_RATE_LIMITED: { code: 'E3003', message: 'Rate limit do provedor atingido', httpStatus: 429, severity: 'medium' },
  LLM_TIMEOUT: { code: 'E3004', message: 'Timeout na chamada LLM', httpStatus: 504, severity: 'high' },
  LLM_ALL_PROVIDERS_FAILED: { code: 'E3005', message: 'Todos os provedores falharam', httpStatus: 503, severity: 'critical' },

  // Security (4xxx)
  SEC_PROMPT_INJECTION: { code: 'E4001', message: 'Prompt injection detectado', httpStatus: 403, severity: 'critical' },
  SEC_PII_DETECTED: { code: 'E4002', message: 'Dados pessoais detectados no input', httpStatus: 400, severity: 'high' },
  SEC_INPUT_TOO_LONG: { code: 'E4003', message: 'Input excede o limite máximo', httpStatus: 400, severity: 'low' },
  SEC_CIRCUIT_OPEN: { code: 'E4004', message: 'Serviço temporariamente indisponível', httpStatus: 503, severity: 'high' },

  // RAG (5xxx)
  RAG_NO_CHUNKS: { code: 'E5001', message: 'Nenhum chunk encontrado para a query', httpStatus: 404, severity: 'low' },
  RAG_INGEST_FAILED: { code: 'E5002', message: 'Erro ao processar documento', httpStatus: 500, severity: 'medium' },
  RAG_EMBEDDING_FAILED: { code: 'E5003', message: 'Erro ao gerar embeddings', httpStatus: 500, severity: 'medium' },

  // Workflow (6xxx)
  WF_NOT_FOUND: { code: 'E6001', message: 'Workflow não encontrado', httpStatus: 404, severity: 'low' },
  WF_EXECUTION_FAILED: { code: 'E6002', message: 'Erro na execução do workflow', httpStatus: 500, severity: 'high' },
  WF_NODE_TIMEOUT: { code: 'E6003', message: 'Timeout no node do workflow', httpStatus: 504, severity: 'medium' },
  WF_MAX_ITERATIONS: { code: 'E6004', message: 'Limite de iterações atingido', httpStatus: 400, severity: 'medium' },

  // Database (7xxx)
  DB_CONNECTION_FAILED: { code: 'E7001', message: 'Erro de conexão com o banco', httpStatus: 500, severity: 'critical' },
  DB_QUERY_FAILED: { code: 'E7002', message: 'Erro na execução da query', httpStatus: 500, severity: 'high' },
  DB_VALIDATION_FAILED: { code: 'E7003', message: 'Nome de tabela/coluna inválido', httpStatus: 400, severity: 'medium' },

  // General (9xxx)
  UNKNOWN_ERROR: { code: 'E9001', message: 'Erro desconhecido — tente novamente', httpStatus: 500, severity: 'high' },
  NETWORK_ERROR: { code: 'E9002', message: 'Erro de rede — verifique sua conexão', httpStatus: 0, severity: 'medium' },
  FEATURE_DISABLED: { code: 'E9003', message: 'Esta funcionalidade está desabilitada', httpStatus: 403, severity: 'low' },
};

/** Create a typed error with code lookup. */
export function createAppError(code: keyof typeof ERROR_CODES, details?: string): Error & { appError: AppError } {
  const appError = ERROR_CODES[code];
  const error = new Error(details ? `${appError.message}: ${details}` : appError.message) as Error & { appError: AppError };
  error.appError = appError;
  return error;
}

/** Get user-friendly message for an error. */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'appError' in error) {
    return (error as { appError: AppError }).appError.message;
  }
  if (error instanceof Error) return error.message;
  return ERROR_CODES.UNKNOWN_ERROR.message;
}
