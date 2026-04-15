/**
 * Nexus — NLP Pipeline Service
 * Connects to nlp-pipeline edge function v2.4
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

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
  const { data, error } = await supabase.functions.invoke('nlp-pipeline', {
    body: { text, pipeline },
  });
  if (error) {
    logger.error('NLP Pipeline failed', { error: error.message });
    throw new Error(`NLP Pipeline error: ${error.message}`);
  }
  return data as NLPResult;
}

export async function analyzeWhatsAppMessage(text: string) {
  const result = await analyzeText(text, ['ner', 'sentiment']);
  return {
    order: result.ner?.structured_order || {},
    sentiment: result.sentiment?.label || 'neutral',
    entities: result.ner?.entities || [],
  };
}
