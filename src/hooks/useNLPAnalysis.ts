import { useState, useCallback } from 'react';
import { analyzeText, type NLPResult } from '@/services/nlpPipelineService';

export function useNLPAnalysis() {
  const [result, setResult] = useState<NLPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (text: string, pipeline?: ('ner' | 'sentiment')[]) => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeText(text, pipeline);
      setResult(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyze, result, loading, error };
}
