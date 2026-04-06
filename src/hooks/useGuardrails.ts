import { useState, useCallback } from 'react';
import { checkInput, checkOutput, type GuardrailResponse } from '@/services/guardrailsMLService';

export function useGuardrails() {
  const [lastCheck, setLastCheck] = useState<GuardrailResponse | null>(null);
  const [checking, setChecking] = useState(false);

  const validateInput = useCallback(async (text: string): Promise<boolean> => {
    setChecking(true);
    try {
      const result = await checkInput(text);
      setLastCheck(result);
      return result.allowed;
    } catch {
      return true; // Fail open
    } finally {
      setChecking(false);
    }
  }, []);

  const validateOutput = useCallback(async (text: string): Promise<boolean> => {
    setChecking(true);
    try {
      const result = await checkOutput(text);
      setLastCheck(result);
      return result.allowed;
    } catch {
      return true;
    } finally {
      setChecking(false);
    }
  }, []);

  return { validateInput, validateOutput, lastCheck, checking };
}
