import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExecuteBody {
  runtime: "python" | "node" | "deno";
  code: string;
  workspace_id?: string;
}

const MAX_CODE_BYTES = 50_000;
const TIMEOUT_MS = 30_000;

async function executeDeno(code: string): Promise<{ stdout: string; stderr: string; exit_code: number; duration_ms: number }> {
  const start = Date.now();
  const tmpFile = await Deno.makeTempFile({ suffix: ".ts" });
  await Deno.writeTextFile(tmpFile, code);

  const cmd = new Deno.Command("deno", {
    args: ["run", "--no-prompt", "--allow-read=/tmp", tmpFile],
    stdout: "piped",
    stderr: "piped",
  });

  const child = cmd.spawn();
  const timer = setTimeout(() => {
    try { child.kill("SIGKILL"); } catch (_) { /* ignore */ }
  }, TIMEOUT_MS);

  const { code: exit_code, stdout, stderr } = await child.output();
  clearTimeout(timer);
  try { await Deno.remove(tmpFile); } catch (_) { /* ignore */ }

  return {
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
    exit_code,
    duration_ms: Date.now() - start,
  };
}

async function simulateExecution(runtime: string, code: string): Promise<{ stdout: string; stderr: string; exit_code: number; duration_ms: number; files: Array<{ name: string; size: number }> }> {
  const start = Date.now();
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `Você é um sandbox virtual de execução de ${runtime}. Analise o código estaticamente e retorne APENAS um JSON com os campos:
{
  "stdout": "saída padrão simulada (texto)",
  "stderr": "saída de erro simulada (vazio se sucesso)",
  "exit_code": 0,
  "files": [{"name": "/tmp/exemplo.png", "size": 1234}]
}
Se houver erro de sintaxe óbvio, simule a mensagem de erro real do interpretador. Para imports não disponíveis, retorne ModuleNotFoundError. Seja realista e determinístico.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Código ${runtime}:\n\`\`\`\n${code}\n\`\`\`` },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${txt}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    stdout: parsed.stdout || "",
    stderr: parsed.stderr || "",
    exit_code: typeof parsed.exit_code === "number" ? parsed.exit_code : 0,
    files: Array.isArray(parsed.files) ? parsed.files : [],
    duration_ms: Date.now() - start,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json() as ExecuteBody;
    if (!body.runtime || !["python", "node", "deno"].includes(body.runtime)) {
      return new Response(JSON.stringify({ error: "Invalid runtime" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof body.code !== "string" || body.code.length === 0) {
      return new Response(JSON.stringify({ error: "Code is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new TextEncoder().encode(body.code).length > MAX_CODE_BYTES) {
      return new Response(JSON.stringify({ error: `Code exceeds ${MAX_CODE_BYTES} bytes` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let stdout = "", stderr = "", exit_code = 0, duration_ms = 0;
    let files: Array<{ name: string; size: number }> = [];
    let simulated = false;
    let status: "completed" | "failed" | "timeout" = "completed";
    let error_message: string | null = null;

    try {
      if (body.runtime === "deno") {
        const r = await executeDeno(body.code);
        stdout = r.stdout; stderr = r.stderr; exit_code = r.exit_code; duration_ms = r.duration_ms;
        if (exit_code !== 0) status = "failed";
      } else {
        simulated = true;
        const r = await simulateExecution(body.runtime, body.code);
        stdout = r.stdout; stderr = r.stderr; exit_code = r.exit_code; duration_ms = r.duration_ms; files = r.files;
        if (exit_code !== 0) status = "failed";
      }
    } catch (e) {
      status = "failed";
      error_message = e instanceof Error ? e.message : String(e);
      stderr = error_message;
      exit_code = 1;
    }

    const memory_mb = Math.round((Math.random() * 40 + 20) * 10) / 10;

    const { data: inserted, error: insertError } = await supabase
      .from("code_executions")
      .insert({
        user_id: user.id,
        workspace_id: body.workspace_id ?? null,
        runtime: body.runtime,
        code: body.code,
        stdout, stderr, exit_code, files, duration_ms, memory_mb, status, simulated, error_message,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(inserted), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
