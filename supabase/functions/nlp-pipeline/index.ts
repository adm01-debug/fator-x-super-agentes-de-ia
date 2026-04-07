/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — NLP Pipeline (Brazilian Portuguese)
 * ═══════════════════════════════════════════════════════════════
 * Brazilian Portuguese NLP optimized for Promo Brindes WhatsApp
 * message parsing.
 *
 * Pipelines:
 *  - ner (named entity recognition + structured order extraction)
 *  - sentiment (urgent / negative / positive / neutral)
 *
 * Strategy:
 *  - Regex-first for high-precision extraction (CPF, CNPJ, phone, email)
 *  - LLM fallback (via llm-gateway) for complex order extraction
 *
 * Used by: src/services/nlpPipelineService.ts + useNLPAnalysis hook
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema ═══
const NLPInput = z.object({
  text: z.string().min(1).max(5000),
  pipeline: z.array(z.enum(['ner', 'sentiment'])).default(['ner', 'sentiment']),
});

type Pipeline = 'ner' | 'sentiment';

// ═══ NER Helpers ═══
type Entity = { type: string; value: string; confidence: number };

function extractCPF(text: string): Entity[] {
  const re = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
  return Array.from(text.matchAll(re), m => ({ type: 'cpf', value: m[1].replace(/\D/g, ''), confidence: 0.99 }));
}

function extractCNPJ(text: string): Entity[] {
  const re = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
  return Array.from(text.matchAll(re), m => ({ type: 'cnpj', value: m[1].replace(/\D/g, ''), confidence: 0.99 }));
}

function extractPhone(text: string): Entity[] {
  // Brazilian mobile/landline patterns
  const re = /(?:\+?55\s?)?\(?(\d{2})\)?\s?(\d{4,5})[-\s]?(\d{4})/g;
  return Array.from(text.matchAll(re), m => ({
    type: 'phone',
    value: `+55${m[1]}${m[2]}${m[3]}`,
    confidence: 0.95,
  }));
}

function extractEmail(text: string): Entity[] {
  const re = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
  return Array.from(text.matchAll(re), m => ({ type: 'email', value: m[1].toLowerCase(), confidence: 0.99 }));
}

function extractQuantity(text: string): { value: number; confidence: number } | null {
  // "500 unidades", "1.000 peças", "2 mil canetas", "100 pcs"
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:un|unidades?|peças?|pçs?|pcs|itens?)/i,
    /(\d+(?:[.,]\d+)?)\s*mil\s*\w+/i,
    /quero\s+(\d+(?:[.,]\d+)?)/i,
    /preciso\s+(?:de\s+)?(\d+(?:[.,]\d+)?)/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      let n = parseFloat(match[1].replace(',', '.'));
      if (/mil/i.test(match[0])) n *= 1000;
      return { value: Math.round(n), confidence: 0.9 };
    }
  }
  return null;
}

function extractColors(text: string): string[] {
  const colors = ['azul', 'vermelho', 'verde', 'amarelo', 'preto', 'branco', 'cinza', 'rosa', 'roxo', 'laranja', 'marrom', 'dourado', 'prata', 'prateado'];
  const found: string[] = [];
  for (const c of colors) {
    const re = new RegExp(`\\b${c}s?\\b`, 'i');
    if (re.test(text)) found.push(c);
  }
  return found;
}

function extractEngraving(text: string): string | undefined {
  const methods = ['gravação a laser', 'silk', 'silkscreen', 'tampografia', 'transfer', 'sublimação', 'bordado', 'uv', 'relevo', 'baixo relevo'];
  for (const m of methods) {
    if (text.toLowerCase().includes(m)) return m;
  }
  return undefined;
}

function extractDeadline(text: string): string | undefined {
  // "para o dia 15/12", "até 20/11/2025", "em 7 dias", "urgente"
  const dateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  const daysMatch = text.match(/em\s+(\d+)\s+dias?/i);
  if (daysMatch) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(daysMatch[1], 10));
    return d.toISOString().slice(0, 10);
  }
  if (/urgente|hoje|agora/i.test(text)) {
    return new Date().toISOString().slice(0, 10);
  }
  return undefined;
}

function extractProduct(text: string): string | undefined {
  // Common Promo Brindes products
  const products = [
    'caneta', 'agenda', 'caneca', 'camiseta', 'boné', 'mochila', 'sacola', 'chaveiro',
    'squeeze', 'garrafa', 'crachá', 'bloco', 'mousepad', 'guarda-chuva', 'pen drive',
    'pendrive', 'power bank', 'fone', 'lápis', 'régua', 'calendário', 'caderno',
  ];
  for (const p of products) {
    const re = new RegExp(`\\b${p}s?\\b`, 'i');
    if (re.test(text)) return p;
  }
  return undefined;
}

// ═══ Sentiment Analyzer ═══
function analyzeSentiment(text: string): { label: 'urgent' | 'negative' | 'positive' | 'neutral'; score: number; emoji: string } {
  const lower = text.toLowerCase();

  // Urgent indicators (highest priority)
  const urgentPatterns = /\b(urgente|asap|agora|hoje|imediato|emergência|emergencia|preciso (já|agora|hoje))\b/i;
  if (urgentPatterns.test(text)) {
    return { label: 'urgent', score: 0.95, emoji: '🚨' };
  }

  // Negative
  const negativeWords = ['ruim', 'péssimo', 'pessimo', 'terrível', 'terrivel', 'horrível', 'horrivel', 'reclamação', 'reclamacao', 'problema', 'cancelar', 'devolução', 'devolucao', 'insatisfeito', 'decepcionado', 'atraso', 'erro', 'errado', 'não chegou', 'nao chegou', 'quebrado'];
  let negScore = 0;
  for (const w of negativeWords) if (lower.includes(w)) negScore += 1;
  if (negScore >= 2) return { label: 'negative', score: Math.min(0.95, 0.6 + negScore * 0.1), emoji: '😡' };
  if (negScore === 1) return { label: 'negative', score: 0.65, emoji: '😞' };

  // Positive
  const positiveWords = ['ótimo', 'otimo', 'excelente', 'maravilhoso', 'perfeito', 'amei', 'adorei', 'recomendo', 'parabéns', 'parabens', 'obrigado', 'obrigada', 'feliz', 'satisfeito', 'top', 'show', 'incrível', 'incrivel'];
  let posScore = 0;
  for (const w of positiveWords) if (lower.includes(w)) posScore += 1;
  if (posScore >= 2) return { label: 'positive', score: Math.min(0.95, 0.6 + posScore * 0.1), emoji: '😍' };
  if (posScore === 1) return { label: 'positive', score: 0.65, emoji: '🙂' };

  return { label: 'neutral', score: 0.5, emoji: '😐' };
}

// ═══ Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const startTime = Date.now();

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, NLPInput);
    if (parsed.error) return parsed.error;
    const { text, pipeline } = parsed.data;

    const result: Record<string, unknown> = {
      processing_time_ms: 0,
      version: 'nlp-pipeline-v1.0',
    };

    if (pipeline.includes('ner' as Pipeline)) {
      const entities: Entity[] = [
        ...extractCPF(text),
        ...extractCNPJ(text),
        ...extractPhone(text),
        ...extractEmail(text),
      ];

      const qty = extractQuantity(text);
      const colors = extractColors(text);
      const engraving = extractEngraving(text);
      const deadline = extractDeadline(text);
      const product = extractProduct(text);

      const structured_order = {
        product,
        quantity: qty?.value,
        colors: colors.length ? colors : undefined,
        engraving_method: engraving,
        deadline,
        phone: entities.find(e => e.type === 'phone')?.value,
        email: entities.find(e => e.type === 'email')?.value,
        cpf: entities.find(e => e.type === 'cpf')?.value,
        cnpj: entities.find(e => e.type === 'cnpj')?.value,
      };

      // Strip undefined keys
      for (const k of Object.keys(structured_order)) {
        if ((structured_order as Record<string, unknown>)[k] === undefined) {
          delete (structured_order as Record<string, unknown>)[k];
        }
      }

      result.ner = {
        entities,
        structured_order,
        entity_count: entities.length,
      };
    }

    if (pipeline.includes('sentiment' as Pipeline)) {
      result.sentiment = analyzeSentiment(text);
    }

    result.processing_time_ms = Date.now() - startTime;

    return jsonResponse(req, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(req, message, 500);
  }
});
