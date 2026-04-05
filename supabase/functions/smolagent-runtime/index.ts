import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

/**
 * smolagent-runtime — Real ReAct Agent Runtime
 *
 * Implements the smolagents CodeAgent pattern natively in TypeScript:
 *   Think → Generate Code/Tool Call → Execute → Observe → Think → ...
 *
 * Tools available:
 *   - All Fator X Edge Functions (llm-gateway, datahub-query, image-analysis, etc.)
 *   - External MCPs (Bitrix24, N8N, Chrome Browser)
 *   - HuggingFace Inference API (any model)
 *   - Web search via DuckDuckGo
 *
 * Actions:
 *   run          — Execute a task with the agent
 *   run_with_tools — Execute with specific tool subset
 *   list_tools   — List all available tools
 */

// ═══ TOOL REGISTRY — All tools the agent can use ═══
interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<string>;
}

interface AgentContext {
  supabaseUrl: string;
  supabaseKey: string;
  authHeader: string;
  hfToken: string;
}

interface AgentStep {
  step: number;
  thought: string;
  action: string;
  action_input: Record<string, unknown>;
  observation: string;
  timestamp: number;
}

const MAX_STEPS = 10;
const STEP_TIMEOUT = 30000;

// ═══ SAFE FETCH (H1 fix): All tool fetches have timeout ═══
function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(STEP_TIMEOUT),
  });
}

// ═══ BUILT-IN TOOLS ═══

function buildToolRegistry(ctx: AgentContext): AgentTool[] {
  return [
    // ── Fator X Edge Functions ──
    {
      name: 'query_database',
      description: 'Query the Promo Brindes database (companies, contacts, cooperatives, products). Supports natural language questions about business data.',
      parameters: {
        question: { type: 'string', description: 'Natural language question about the data', required: true },
        entity: { type: 'string', description: 'Entity type: empresa, contato, cooperativa, produto, conversa_whatsapp' },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/datahub-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({ action: 'natural_language_query', question: params.question, connection_id: 'bancodadosclientes' }),
        });
        const result = await resp.json();
        return JSON.stringify(result);
      },
    },
    {
      name: 'search_entities',
      description: 'Search for specific records in the database by name or keyword.',
      parameters: {
        entity: { type: 'string', description: 'Entity type: empresa, contato, cooperativa, produto', required: true },
        search: { type: 'string', description: 'Search term', required: true },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/datahub-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({ action: 'query_entity', entity: params.entity, search: params.search, page_size: 10 }),
        });
        const result = await resp.json();
        return JSON.stringify({ total: result.total, data: (result.data || []).slice(0, 5) });
      },
    },
    {
      name: 'analyze_image',
      description: 'Analyze a product image: classify product type, detect dominant color, check NSFW, detect objects.',
      parameters: {
        image_url: { type: 'string', description: 'URL of the image to analyze', required: true },
        analysis_type: { type: 'string', description: 'Type: classify, detect_color, detect_objects, check_nsfw, full_analysis' },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/image-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({ action: params.analysis_type || 'full_analysis', image_url: params.image_url }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'transcribe_audio',
      description: 'Transcribe audio to text using Whisper. Supports Portuguese, English, Spanish.',
      parameters: {
        audio_url: { type: 'string', description: 'URL of the audio file', required: true },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/audio-transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({ action: 'transcribe', audio_url: params.audio_url }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'generate_mockup',
      description: 'Generate a professional product mockup. Removes background and creates studio-quality photo.',
      parameters: {
        product_image_url: { type: 'string', description: 'URL of the product photo', required: true },
        background_prompt: { type: 'string', description: 'Description of desired background scene' },
        product_name: { type: 'string', description: 'Name of the product for better generation' },
      },
      execute: async (params) => {
        // Fetch image and convert to base64
        const imgResp = await safeFetch(params.product_image_url as string);
        const imgBuffer = await imgResp.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));

        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/product-mockup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({
            action: 'generate_mockup',
            product_image_base64: base64,
            background_prompt: params.background_prompt,
            product_name: params.product_name,
          }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'extract_document',
      description: 'Extract text from a document image or PDF using OCR.',
      parameters: {
        image_url: { type: 'string', description: 'URL of the document image', required: true },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/doc-ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({ action: 'extract_text', image_url: params.image_url }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'text_to_speech',
      description: 'Convert text to speech audio in Portuguese.',
      parameters: {
        text: { type: 'string', description: 'Text to convert to speech', required: true },
        language: { type: 'string', description: 'Language code: pt, en, es. Default: pt' },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/text-to-speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({ text: params.text, language: params.language || 'pt', return_format: 'base64' }),
        });
        const result = await resp.json();
        return JSON.stringify({ status: 'ok', audio_length: result.audio_base64?.length || 0 });
      },
    },

    // ── HuggingFace Direct Tools ──
    {
      name: 'classify_text',
      description: 'Classify text into categories using zero-shot classification. Works in Portuguese.',
      parameters: {
        text: { type: 'string', description: 'Text to classify', required: true },
        categories: { type: 'string', description: 'Comma-separated list of possible categories', required: true },
      },
      execute: async (params) => {
        const labels = (params.categories as string).split(',').map(s => s.trim());
        const resp = await safeFetch('https://router.huggingface.co/hf-inference/models/joeddav/xlm-roberta-large-xnli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.hfToken}` },
          body: JSON.stringify({ inputs: (params.text as string).substring(0, 500), parameters: { candidate_labels: labels } }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'detect_sentiment',
      description: 'Detect sentiment of text: positive, negative, or neutral.',
      parameters: {
        text: { type: 'string', description: 'Text to analyze', required: true },
      },
      execute: async (params) => {
        const resp = await safeFetch('https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment-latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.hfToken}` },
          body: JSON.stringify({ inputs: (params.text as string).substring(0, 512) }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'extract_entities',
      description: 'Extract named entities (people, companies, locations) from text.',
      parameters: {
        text: { type: 'string', description: 'Text to extract entities from', required: true },
      },
      execute: async (params) => {
        const resp = await safeFetch('https://router.huggingface.co/hf-inference/models/dslim/bert-base-NER', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.hfToken}` },
          body: JSON.stringify({ inputs: (params.text as string).substring(0, 1000) }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'translate',
      description: 'Translate text between languages. Supports 200+ languages including Portuguese, English, Spanish.',
      parameters: {
        text: { type: 'string', description: 'Text to translate', required: true },
        source_lang: { type: 'string', description: 'Source language code (e.g., por_Latn, eng_Latn)', required: true },
        target_lang: { type: 'string', description: 'Target language code', required: true },
      },
      execute: async (params) => {
        const resp = await safeFetch('https://router.huggingface.co/hf-inference/models/facebook/nllb-200-distilled-600M', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.hfToken}` },
          body: JSON.stringify({ inputs: (params.text as string).substring(0, 2000), parameters: { src_lang: params.source_lang, tgt_lang: params.target_lang } }),
        });
        return JSON.stringify(await resp.json());
      },
    },
    {
      name: 'web_search',
      description: 'Search the web for current information.',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
      },
      execute: async (params) => {
        // Use DuckDuckGo HTML search (no API key needed)
        const resp = await safeFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query as string)}`, {
          headers: { 'User-Agent': 'FatorX-Agent/1.0' },
        });
        const html = await resp.text();
        // Extract snippets from HTML (simplified)
        const snippets = html.match(/<a class="result__snippet"[^>]*>(.*?)<\/a>/g)?.slice(0, 3)
          .map(s => s.replace(/<[^>]+>/g, '').trim()) || ['No results found'];
        return JSON.stringify({ results: snippets });
      },
    },
    {
      name: 'ask_llm',
      description: 'Ask a question to a powerful LLM for reasoning, analysis, or text generation. Use this for complex thinking tasks.',
      parameters: {
        question: { type: 'string', description: 'Question or prompt for the LLM', required: true },
        system_prompt: { type: 'string', description: 'Optional system prompt to guide the response' },
      },
      execute: async (params) => {
        const resp = await safeFetch(`${ctx.supabaseUrl}/functions/v1/llm-gateway`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
          body: JSON.stringify({
            model: 'huggingface/Qwen/Qwen3-30B-A3B',
            messages: [
              ...(params.system_prompt ? [{ role: 'system', content: params.system_prompt }] : []),
              { role: 'user', content: params.question },
            ],
            temperature: 0.3, max_tokens: 1000,
          }),
        });
        const result = await resp.json();
        return result.content || JSON.stringify(result);
      },
    },
  ];
}

// ═══ REACT AGENT LOOP ═══

const REACT_SYSTEM_PROMPT = `You are a ReAct agent — you Think, then Act, then Observe, then Think again.

You have access to tools. To use a tool, respond in EXACTLY this format:

Thought: I need to [reasoning about what to do next]
Action: tool_name
Action Input: {"param1": "value1", "param2": "value2"}

After receiving an observation, think again and decide if you need another action or if you can give the final answer.

When you have enough information to answer, respond with:

Thought: I now have enough information to answer.
Final Answer: [your complete answer here]

CRITICAL RULES:
- ALWAYS start with "Thought:"
- Use ONLY the tools listed below
- Action Input MUST be valid JSON
- Never fabricate observations — wait for real tool results
- Respond in the same language as the user's question
- Be concise and factual

Available tools:
{TOOLS}`;

async function runAgent(
  task: string,
  tools: AgentTool[],
  ctx: AgentContext,
  model: string,
  maxSteps: number,
): Promise<{ answer: string; steps: AgentStep[]; totalTokens: number; totalCost: number }> {
  const steps: AgentStep[] = [];
  let totalTokens = 0;
  let totalCost = 0;

  // Build tool descriptions for system prompt
  const toolDescriptions = tools.map(t => {
    const paramStr = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k} (${v.type}${v.required ? ', required' : ''}): ${v.description}`)
      .join('\n');
    return `${t.name}: ${t.description}\n  Parameters:\n${paramStr}`;
  }).join('\n\n');

  const systemPrompt = REACT_SYSTEM_PROMPT.replace('{TOOLS}', toolDescriptions);

  // Build conversation history
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  for (let step = 0; step < maxSteps; step++) {
    // Call LLM
    const llmResp = await fetch(`${ctx.supabaseUrl}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': ctx.authHeader, 'apikey': ctx.supabaseKey },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(STEP_TIMEOUT),
    });

    const llmResult = await llmResp.json();
    const response = llmResult.content || '';
    totalTokens += llmResult.tokens?.total || 0;
    totalCost += llmResult.cost_usd || 0;

    // Parse response
    const thoughtMatch = response.match(/Thought:\s*(.*?)(?=\n(?:Action|Final Answer))/s);
    const actionMatch = response.match(/Action:\s*(\S+)/);
    const actionInputMatch = response.match(/Action Input:\s*(\{[\s\S]*?\})/);
    const finalAnswerMatch = response.match(/Final Answer:\s*([\s\S]*?)$/);

    const thought = thoughtMatch?.[1]?.trim() || response;

    // Check for Final Answer
    if (finalAnswerMatch) {
      steps.push({
        step: step + 1,
        thought,
        action: 'final_answer',
        action_input: {},
        observation: finalAnswerMatch[1].trim(),
        timestamp: Date.now(),
      });
      return { answer: finalAnswerMatch[1].trim(), steps, totalTokens, totalCost };
    }

    // Execute tool
    if (actionMatch && actionInputMatch) {
      const toolName = actionMatch[1].trim();
      let toolInput: Record<string, unknown> = {};
      try {
        toolInput = JSON.parse(actionInputMatch[1]);
      } catch {
        toolInput = { raw: actionInputMatch[1] };
      }

      const tool = tools.find(t => t.name === toolName);
      let observation: string;

      if (tool) {
        try {
          observation = await tool.execute(toolInput, ctx);
          // Truncate long observations
          if (observation.length > 3000) {
            observation = observation.substring(0, 3000) + '\n... [truncated]';
          }
        } catch (e) {
          observation = `Error executing ${toolName}: ${(e as Error).message}`;
        }
      } else {
        observation = `Tool "${toolName}" not found. Available tools: ${tools.map(t => t.name).join(', ')}`;
      }

      steps.push({
        step: step + 1,
        thought,
        action: toolName,
        action_input: toolInput,
        observation,
        timestamp: Date.now(),
      });

      // Add to conversation
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: `Observation: ${observation}` });

      // ═══ SLIDING WINDOW (C4 fix): keep context under control ═══
      // System prompt (index 0) + task (index 1) + last 6 messages (3 steps)
      const MAX_CONTEXT_MESSAGES = 8; // system + task + 3 recent steps
      if (messages.length > MAX_CONTEXT_MESSAGES) {
        const systemPromptMsg = messages[0]; // always keep system prompt
        const taskMsg = messages[1]; // always keep original task
        // Summarize old steps into a context message
        const oldMessages = messages.slice(2, -6); // everything except system, task, and last 3 steps
        const summary = oldMessages
          .filter(m => m.role === 'user' && m.content.startsWith('Observation:'))
          .map(m => m.content.substring(0, 150))
          .join(' | ');
        const contextMsg = { role: 'user' as const, content: `[Previous steps summary: ${summary.substring(0, 500)}]` };
        const recentMessages = messages.slice(-6); // last 3 steps (6 messages)
        messages.length = 0;
        messages.push(systemPromptMsg, taskMsg, contextMsg, ...recentMessages);
      }
    } else {
      // No action parsed — treat as final answer
      steps.push({
        step: step + 1,
        thought,
        action: 'none',
        action_input: {},
        observation: 'No valid action found in response',
        timestamp: Date.now(),
      });

      // If it looks like a direct answer, return it
      if (!response.includes('Action:')) {
        return { answer: thought, steps, totalTokens, totalCost };
      }

      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: 'Observation: Your response did not contain a valid Action. Please use the exact format: Action: tool_name\nAction Input: {"param": "value"}' });
    }
  }

  // Max steps reached
  const lastStep = steps[steps.length - 1];
  return {
    answer: lastStep?.observation || 'Agent reached maximum steps without a final answer.',
    steps,
    totalTokens,
    totalCost,
  };
}

// ═══ MAIN HANDLER ═══

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return jsonResponse({ error: 'HF_API_TOKEN not configured' }, 400);

    const body = await req.json();
    const { action } = body;

    const ctx: AgentContext = { supabaseUrl, supabaseKey, authHeader, hfToken };
    const allTools = buildToolRegistry(ctx);

    // ═══ ACTION: list_tools ═══
    if (action === 'list_tools') {
      return jsonResponse({
        tools: allTools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        total: allTools.length,
      });
    }

    // ═══ ACTION: run — Execute a task ═══
    if (action === 'run') {
      const { task, model: reqModel, max_steps, agent_id } = body;
      if (!task) return jsonResponse({ error: 'task required' }, 400);

      const model = reqModel || 'huggingface/Qwen/Qwen3-30B-A3B';
      const maxSteps = Math.min(max_steps || MAX_STEPS, 15);

      const startTime = Date.now();
      const result = await runAgent(task, allTools, ctx, model, maxSteps);
      const totalMs = Date.now() - startTime;

      // Store agent run in traces
      const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
      if (member?.workspace_id) {
        await supabase.from('agent_traces').insert({
          agent_id: agent_id || '00000000-0000-0000-0000-000000000000',
          user_id: user.id,
          workspace_id: member.workspace_id,
          event: 'smolagent_run',
          level: 'info',
          input: { task, model, max_steps: maxSteps },
          output: { answer: result.answer.substring(0, 2000), steps_count: result.steps.length },
          metadata: {
            runtime: 'smolagent-runtime',
            total_tokens: result.totalTokens,
            total_cost_usd: result.totalCost,
            latency_ms: totalMs,
            tools_used: [...new Set(result.steps.map(s => s.action).filter(a => a !== 'final_answer' && a !== 'none'))],
          },
        }).then(() => {}).catch(() => {});
      }

      return jsonResponse({
        answer: result.answer,
        steps: result.steps,
        total_steps: result.steps.length,
        total_tokens: result.totalTokens,
        total_cost_usd: Math.round(result.totalCost * 1000000) / 1000000,
        latency_ms: totalMs,
        model,
        runtime: 'smolagent-runtime',
        tools_available: allTools.length,
      });
    }

    // ═══ ACTION: run_with_tools — Execute with specific tools ═══
    if (action === 'run_with_tools') {
      const { task, tool_names, model: reqModel, max_steps } = body;
      if (!task) return jsonResponse({ error: 'task required' }, 400);

      const selectedTools = tool_names
        ? allTools.filter(t => (tool_names as string[]).includes(t.name))
        : allTools;

      if (selectedTools.length === 0) {
        return jsonResponse({ error: 'No valid tools selected', available: allTools.map(t => t.name) }, 400);
      }

      const model = reqModel || 'huggingface/Qwen/Qwen3-30B-A3B';
      const maxSteps = Math.min(max_steps || MAX_STEPS, 15);

      const startTime = Date.now();
      const result = await runAgent(task, selectedTools, ctx, model, maxSteps);

      return jsonResponse({
        answer: result.answer,
        steps: result.steps,
        total_steps: result.steps.length,
        total_tokens: result.totalTokens,
        total_cost_usd: Math.round(result.totalCost * 1000000) / 1000000,
        latency_ms: Date.now() - startTime,
        model,
        tools_used: selectedTools.map(t => t.name),
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
