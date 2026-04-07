import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY") || Deno.env.get("HF_API_TOKEN") || "";
const HF_API = "https://router.huggingface.co/hf-inference/models";

const VERSION = "v2.4";

// NER patterns for Brazilian commerce
const PATTERNS = {
  phone: /(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/g,
  email: /[\w.-]+@[\w.-]+\.\w{2,}/g,
  cpf: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
  cnpj: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
  quantity: /(\d+)\s*(?:unid|un|pç|peça|peças|caixa|cx|par|pares|kit|kits|dúzia|duzia|mil|milheiro)/gi,
  price: /R\$\s*[\d.,]+/g,
  deadline: /(?:até|para|prazo|entrega)\s*(?:dia\s*)?\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?/gi,
  color: /(?:cor|cores?|na cor|em)\s+([\w\s,]+?)(?:\.|,|$)/gi,
  material: /(?:material|em|de)\s+(acrílico|metal|madeira|mdf|plástico|vidro|couro|tecido|algodão|poliéster|inox|alumínio|cristal)/gi,
  engraving: /(?:gravar|gravação|gravado|personalizar|personalização|bordar|bordado|estampar|estampa|serigrafia|sublimação|laser|uv)/gi,
};

interface NLPEntity {
  type: string;
  value: string;
  confidence: number;
}

function extractEntities(text: string): { entities: NLPEntity[]; structured_order: Record<string, unknown> } {
  const entities: NLPEntity[] = [];
  const order: Record<string, unknown> = {};
  const lower = text.toLowerCase();

  // Phone
  for (const m of text.matchAll(PATTERNS.phone)) {
    entities.push({ type: "PHONE", value: m[0].trim(), confidence: 0.9 });
    order.phone = m[0].trim();
  }
  // Email
  for (const m of text.matchAll(PATTERNS.email)) {
    entities.push({ type: "EMAIL", value: m[0], confidence: 0.95 });
    order.email = m[0];
  }
  // CPF
  for (const m of text.matchAll(PATTERNS.cpf)) {
    entities.push({ type: "CPF", value: m[0], confidence: 0.9 });
    order.cpf = m[0];
  }
  // CNPJ
  for (const m of text.matchAll(PATTERNS.cnpj)) {
    entities.push({ type: "CNPJ", value: m[0], confidence: 0.9 });
    order.cnpj = m[0];
  }
  // Quantity
  for (const m of text.matchAll(PATTERNS.quantity)) {
    const qty = parseInt(m[1]);
    entities.push({ type: "QUANTITY", value: m[0].trim(), confidence: 0.85 });
    order.quantity = qty;
  }
  // Price
  for (const m of text.matchAll(PATTERNS.price)) {
    entities.push({ type: "PRICE", value: m[0], confidence: 0.9 });
    const numStr = m[0].replace("R$", "").replace(/\s/g, "").replace(",", ".");
    order.unit_price = parseFloat(numStr);
  }
  // Deadline
  for (const m of text.matchAll(PATTERNS.deadline)) {
    entities.push({ type: "DEADLINE", value: m[0].trim(), confidence: 0.8 });
    order.deadline = m[0].trim();
  }
  // Color
  for (const m of text.matchAll(PATTERNS.color)) {
    const colors = m[1].trim().split(/[,\se]+/).filter(Boolean);
    entities.push({ type: "COLOR", value: colors.join(", "), confidence: 0.8 });
    order.colors = colors;
  }
  // Material
  for (const m of text.matchAll(PATTERNS.material)) {
    entities.push({ type: "MATERIAL", value: m[1], confidence: 0.85 });
    order.material = m[1];
  }
  // Engraving
  for (const m of text.matchAll(PATTERNS.engraving)) {
    entities.push({ type: "ENGRAVING_METHOD", value: m[0].trim(), confidence: 0.8 });
    order.engraving_method = m[0].trim();
  }

  // Estimate total
  if (order.quantity && order.unit_price) {
    order.estimated_total = (order.quantity as number) * (order.unit_price as number);
  }

  return { entities, structured_order: order };
}

function analyzeSentiment(text: string): { label: string; score: number; emoji: string } {
  const lower = text.toLowerCase();
  const urgentWords = ["urgente", "urgência", "emergência", "rápido", "imediato", "agora", "hoje", "ontem", "prazo curto"];
  const negativeWords = ["reclamação", "problema", "defeito", "errado", "péssimo", "horrível", "ruim", "cancelar", "devolver", "reembolso"];
  const positiveWords = ["obrigado", "parabéns", "excelente", "ótimo", "maravilhoso", "perfeito", "adorei", "amei", "recomendo"];

  const urgentScore = urgentWords.filter(w => lower.includes(w)).length;
  const negativeScore = negativeWords.filter(w => lower.includes(w)).length;
  const positiveScore = positiveWords.filter(w => lower.includes(w)).length;

  if (urgentScore > 0) return { label: "urgent", score: Math.min(0.5 + urgentScore * 0.15, 1), emoji: "🔴" };
  if (negativeScore > positiveScore) return { label: "negative", score: Math.min(0.5 + negativeScore * 0.15, 1), emoji: "😡" };
  if (positiveScore > 0) return { label: "positive", score: Math.min(0.5 + positiveScore * 0.15, 1), emoji: "😊" };
  return { label: "neutral", score: 0.5, emoji: "😐" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ service: "nlp-pipeline", version: VERSION, status: "healthy" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  try {
    const { text, pipeline = ["ner", "sentiment"] } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const result: Record<string, unknown> = {};

    if (pipeline.includes("ner")) {
      const { entities, structured_order } = extractEntities(text);
      result.ner = { entities, structured_order, entity_count: entities.length };
    }

    if (pipeline.includes("sentiment")) {
      result.sentiment = analyzeSentiment(text);
    }

    result.processing_time_ms = Date.now() - start;
    result.version = VERSION;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
