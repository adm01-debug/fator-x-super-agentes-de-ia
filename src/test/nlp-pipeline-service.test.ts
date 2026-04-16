import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn().mockResolvedValue({
  data: {
    ner: { entities: [{ type: 'product', value: 'caneca', confidence: 0.95 }], structured_order: { product: 'caneca' }, entity_count: 1 },
    sentiment: { label: 'positive', score: 0.85, emoji: '😊' },
    processing_time_ms: 120,
    version: '2.4',
  },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

describe('nlpPipelineService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('analyzeText returns NLP result', async () => {
    const { analyzeText } = await import('@/services/nlpPipelineService');
    const result = await analyzeText('Preciso de 100 canecas');
    expect(result).toHaveProperty('ner');
    expect(result).toHaveProperty('sentiment');
    expect(result.ner?.entities).toHaveLength(1);
  });

  it('analyzeText throws on error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'NLP fail' } });
    const { analyzeText } = await import('@/services/nlpPipelineService');
    await expect(analyzeText('test')).rejects.toThrow('NLP Pipeline error');
  });

  it('analyzeWhatsAppMessage returns structured result', async () => {
    const { analyzeWhatsAppMessage } = await import('@/services/nlpPipelineService');
    const result = await analyzeWhatsAppMessage('Quero 50 canecas personalizadas');
    expect(result).toHaveProperty('order');
    expect(result).toHaveProperty('sentiment');
    expect(result).toHaveProperty('entities');
  });
});
