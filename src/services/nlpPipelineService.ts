/**
 * Nexus — NLP Pipeline Service
 * Connects to nlp-pipeline edge function v2.4
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const TIMEOUT_MS = 30_000;

async function invokeEdgeFn(name: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke(name, { body, signal: controller.signal as AbortSignal });
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error(`${name} timeout after ${TIMEOUT_MS}ms`);
    throw e;
  } finally { clearTimeout(timer); }
}

export interface NLPEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface StructuredOrder {
  product?: string;
  quantity?: number;
  colors?: string[];
  material?: string;
  engraving_method?: string;
  engraving?: string;
  deadline?: string;
  unit_price?: number;
  estimated_total?: number;
  phone?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
}

export interface NLPResult {
  ner?: {
    entities: NLPEntity[];
    structured_order: StructuredOrder;
    entity_count: number;
  };
  sentiment?: {
    label: 'urgent' | 'negative' | 'positive' | 'neutral';
    score: number;
    emoji: string;
  };
  processing_time_ms: number;
  version: string;
}

export async function analyzeText(text: string, pipeline: ('ner' | 'sentiment')[] = ['ner', 'sentiment']): Promise<NLPResult> {
  try {
    return await invokeEdgeFn('nlp-pipeline', { text, pipeline }) as NLPResult;
  } catch (e) {
    logger.error('NLP Pipeline failed', e);
    throw e;
  }
}

export async function analyzeWhatsAppMessage(text: string) {
  const result = await analyzeText(text, ['ner', 'sentiment']);
  return {
    order: result.ner?.structured_order || {},
    sentiment: result.sentiment?.label || 'neutral',
    entities: result.ner?.entities || [],
  };
}
