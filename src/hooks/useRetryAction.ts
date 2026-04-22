/**
 * Nexus Agents Studio — useRetryAction Hook
 *
 * Wraps async actions with retry logic from retryEngineService.
 * Automatically uses circuit breaker when a service name is provided.
 */

import { useState, useCallback } from 'react';
import {
  executeWithRetry,
  executeWithCircuitBreaker,
  type RetryPolicy,
  type RetryResult,
  RETRY_PRESETS,
} from '@/services/retryEngineService';
import { useToast } from '@/hooks/use-toast';

interface UseRetryActionOptions {
  /** Retry policy preset name or custom policy */
  policy?: keyof typeof RETRY_PRESETS | RetryPolicy;
  /** Service name for circuit breaker tracking */
  serviceName?: string;
  /** Operation name for logging */
  operationName?: string;
  /** Show toast on success */
  showSuccessToast?: boolean;
  /** Show toast on failure */
  showErrorToast?: boolean;
  /** Custom success message */
  successMessage?: string;
}

export function useRetryAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseRetryActionOptions = {},
) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<RetryResult<TResult> | null>(null);
  const { toast } = useToast();

  const resolvePolicy = useCallback((): RetryPolicy => {
    if (!options.policy) return RETRY_PRESETS.api_call;
    if (typeof options.policy === 'string') return RETRY_PRESETS[options.policy];
    return options.policy;
  }, [options.policy]);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      const policy = resolvePolicy();
      const opName = options.operationName ?? 'operation';

      try {
        const result = options.serviceName
          ? await executeWithCircuitBreaker(options.serviceName, () => action(...args), policy)
          : await executeWithRetry(() => action(...args), policy, opName);

        setLastResult(result as RetryResult<TResult>);

        if (result.success) {
          if (options.showSuccessToast !== false && result.attempts.length > 1) {
            toast({
              title: options.successMessage ?? 'Operação concluída',
              description: `Sucesso após ${result.attempts.length} tentativa(s)`,
            });
          }
          return result.data;
        }

        if (result.circuit_opened) {
          if (options.showErrorToast !== false) {
            toast({
              title: 'Serviço indisponível',
              description: `Circuit breaker aberto para ${options.serviceName}. Tente novamente em breve.`,
              variant: 'destructive',
            });
          }
          return null;
        }

        if (options.showErrorToast !== false) {
          toast({
            title: 'Operação falhou',
            description: result.final_error ?? 'Erro desconhecido após todas as tentativas',
            variant: 'destructive',
          });
        }
        return null;
      } catch (e) {
        if (options.showErrorToast !== false) {
          toast({
            title: 'Erro inesperado',
            description: e instanceof Error ? e.message : 'Erro desconhecido',
            variant: 'destructive',
          });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action, options, toast, resolvePolicy],
  );

  return {
    execute,
    loading,
    lastResult,
    attempts: lastResult?.attempts ?? [],
    wasRetried: (lastResult?.attempts.length ?? 0) > 1,
    circuitOpen: lastResult?.circuit_opened ?? false,
  };
}
