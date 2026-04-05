import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LLMRequest {
  agent_id?: string;
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * Determine provider from model name.
 * - Models starting with "claude" route to Anthropic.
 * - Everything else routes to OpenRouter.
 */
function resolveProvider(model: string): "anthropic" | "openrouter" {
  if (model.startsWith("claude")) return "anthropic";
  return "openrouter";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LLMRequest["messages"],
  temperature: number,
  maxTokens: number,
): Promise<{ content: string; tokens_in: number; tokens_out: number }> {
  // Separate system message from the rest
  const systemMsgs = messages.filter((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: nonSystemMsgs,
  };
  if (systemMsgs.length > 0) {
    body.system = systemMsgs.map((m) => m.content).join("\n");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text ?? "";
  return {
    content,
    tokens_in: data.usage?.input_tokens ?? 0,
    tokens_out: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: LLMRequest["messages"],
  temperature: number,
  maxTokens: number,
): Promise<{ content: string; tokens_in: number; tokens_out: number }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    content,
    tokens_in: data.usage?.prompt_tokens ?? 0,
    tokens_out: data.usage?.completion_tokens ?? 0,
  };
}

/** Very rough cost estimate (USD) based on token counts. */
function estimateCost(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  // Conservative defaults; real pricing would come from a lookup table.
  const inputRate = provider === "anthropic" ? 0.000003 : 0.000001;
  const outputRate = provider === "anthropic" ? 0.000015 : 0.000002;
  return tokensIn * inputRate + tokensOut * outputRate;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      agent_id,
      model = "claude-sonnet-4-20250514",
      messages,
      temperature = 0.7,
      max_tokens = 1024,
    } = (await req.json()) as LLMRequest;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provider = resolveProvider(model);
    const startMs = Date.now();

    let result: { content: string; tokens_in: number; tokens_out: number };

    if (provider === "anthropic") {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
      result = await callAnthropic(apiKey, model, messages, temperature, max_tokens);
    } else {
      const apiKey = Deno.env.get("OPENROUTER_API_KEY");
      if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
      result = await callOpenRouter(apiKey, model, messages, temperature, max_tokens);
    }

    const latencyMs = Date.now() - startMs;
    const costUsd = estimateCost(provider, model, result.tokens_in, result.tokens_out);
    const traceId = crypto.randomUUID();

    // Optionally log usage to Supabase
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("llm_usage_logs").insert({
          trace_id: traceId,
          agent_id: agent_id ?? null,
          model,
          provider,
          tokens_in: result.tokens_in,
          tokens_out: result.tokens_out,
          cost_usd: costUsd,
          latency_ms: latencyMs,
        });
      }
    } catch {
      // Non-critical — don't fail the request if logging fails
    }

    const payload = {
      content: result.content,
      model,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      trace_id: traceId,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
