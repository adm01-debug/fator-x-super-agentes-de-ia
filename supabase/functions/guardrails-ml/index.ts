import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY") || Deno.env.get("HF_API_TOKEN") || "";
const HF_API = "https://router.huggingface.co/hf-inference/models";
const VERSION = "v2.2";

// Guardrail layers
async function checkPromptInjection(text: string): Promise<{ passed: boolean; score: number; details: string }> {
  if (!HF_API_KEY) {
    // Fallback: pattern-based detection
    const injectionPatterns = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /ignore\s+(all\s+)?(your\s+)?instructions/i,
      /disregard\s+(all\s+)?(your\s+)?instructions/i,
      /you\s+are\s+now\s+a/i,
      /system\s*:\s*/i,
      /\[INST\]/i,
      /<<SYS>>/i,
      /forget\s+(everything|all)/i,
      /pretend\s+(you\s+are|to\s+be)/i,
      /bypass\s+(security|filter|guardrail|safety)/i,
      /jailbreak/i,
      /do\s+anything\s+now/i,
      /DAN\s+mode/i,
      /reveal\s+(your\s+)?(system|internal)\s*prompt/i,
      /override\s+(your\s+)?(instructions|rules|guidelines)/i,
      /act\s+as\s+(if|though)\s+you\s+(have\s+)?no\s+(restrictions|rules)/i,
      /sudo\s+mode/i,
      /developer\s+mode/i,
      /ignore\s+(safety|content)\s+(policy|filter|guidelines)/i,
      /new\s+instructions?\s*:/i,
    ];
    const matches = injectionPatterns.filter(p => p.test(text));
    const score = matches.length > 0 ? Math.min(0.5 + matches.length * 0.15, 1) : 0.05;
    return { passed: score < 0.5, score, details: matches.length > 0 ? `Detected ${matches.length} injection pattern(s)` : "No injection patterns detected" };
  }

  try {
    const res = await fetch(`${HF_API}/deepset/deberta-v3-base-injection`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text }),
    });
    const data = await res.json();
    const injectionScore = Array.isArray(data?.[0]) ? data[0].find((l: { label: string }) => l.label === "INJECTION")?.score || 0 : 0;
    return { passed: injectionScore < 0.5, score: injectionScore, details: injectionScore >= 0.5 ? "ML model detected prompt injection" : "Clean" };
  } catch {
    return { passed: true, score: 0, details: "ML check unavailable, passed by default" };
  }
}

async function checkToxicity(text: string): Promise<{ passed: boolean; score: number; details: string }> {
  if (!HF_API_KEY) {
    const toxicWords = ["idiota", "merda", "porra", "caralho", "puta", "fuck", "shit", "damn", "kill", "die"];
    const matches = toxicWords.filter(w => text.toLowerCase().includes(w));
    const score = matches.length > 0 ? Math.min(0.4 + matches.length * 0.15, 1) : 0.05;
    return { passed: score < 0.5, score, details: matches.length > 0 ? `${matches.length} toxic word(s) detected` : "Clean" };
  }

  try {
    const res = await fetch(`${HF_API}/unitary/toxic-bert`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text }),
    });
    const data = await res.json();
    const toxicScore = Array.isArray(data?.[0]) ? data[0].find((l: { label: string }) => l.label === "toxic")?.score || 0 : 0;
    return { passed: toxicScore < 0.5, score: toxicScore, details: toxicScore >= 0.5 ? "Toxic content detected" : "Clean" };
  } catch {
    return { passed: true, score: 0, details: "Toxicity check unavailable" };
  }
}

function checkPII(text: string): { passed: boolean; score: number; details: string } {
  const piiPatterns = [
    { name: "CPF", pattern: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g },
    { name: "CNPJ", pattern: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g },
    { name: "Credit Card", pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
    { name: "Email", pattern: /[\w.-]+@[\w.-]+\.\w{2,}/g },
  ];

  const found = piiPatterns.filter(p => p.pattern.test(text)).map(p => p.name);
  return {
    passed: found.length === 0,
    score: found.length > 0 ? 0.8 : 0,
    details: found.length > 0 ? `PII detected: ${found.join(", ")}` : "No PII detected",
  };
}

function checkSecretLeakage(text: string): { passed: boolean; score: number; details: string } {
  const secretPatterns = [
    { name: "HuggingFace Token", pattern: /hf_[a-zA-Z0-9]{20,}/g },
    { name: "OpenAI Key", pattern: /sk-[a-zA-Z0-9]{20,}/g },
    { name: "Anthropic Key", pattern: /sk-ant-[a-zA-Z0-9]{20,}/g },
    { name: "GitHub Token", pattern: /ghp_[a-zA-Z0-9]{36}/g },
    { name: "Supabase Key", pattern: /sbp_[a-zA-Z0-9]{20,}/g },
    { name: "AWS Key", pattern: /AKIA[0-9A-Z]{16}/g },
    { name: "Bearer Token", pattern: /Bearer\s+[a-zA-Z0-9\-._~+\/]{30,}/g },
    { name: "Password", pattern: /(?:password|senha|pwd)\s*[:=]\s*\S{6,}/gi },
  ];
  const found = secretPatterns.filter(p => p.pattern.test(text)).map(p => p.name);
  return {
    passed: found.length === 0,
    score: found.length > 0 ? 0.95 : 0,
    details: found.length > 0 ? `Secret leakage detected: ${found.join(", ")}` : "No secrets detected",
  };
}

function checkLength(text: string, direction: string): { passed: boolean; score: number; details: string } {
  const maxLen = direction === "input" ? 10000 : 50000;
  const ratio = text.length / maxLen;
  return {
    passed: ratio <= 1,
    score: Math.min(ratio, 1),
    details: ratio > 1 ? `Text exceeds max length (${text.length}/${maxLen})` : `Length OK (${text.length}/${maxLen})`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ service: "guardrails-ml", version: VERSION, status: "healthy" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  try {
    const { text, direction = "input" } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [injection, toxicity] = await Promise.all([
      checkPromptInjection(text),
      checkToxicity(text),
    ]);
    const pii = checkPII(text);
    const secrets = checkSecretLeakage(text);
    const length = checkLength(text, direction);

    const results = [
      { layer: "prompt_injection", ...injection },
      { layer: "toxicity", ...toxicity },
      { layer: "pii_leak", ...pii },
      { layer: "secret_leakage", ...secrets },
      { layer: "length", ...length },
    ];

    const blocked = results.filter(r => !r.passed);

    return new Response(JSON.stringify({
      allowed: blocked.length === 0,
      direction,
      results,
      blocked_count: blocked.length,
      latency_ms: Date.now() - start,
      version: VERSION,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
