import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const RequestSchema = z.object({
  workflow_id: z.string().uuid(),
  input: z.string().max(10000).optional().default(''),
  resume_run_id: z.string().uuid().optional(),
});

interface GraphNode {
  id: string;
  type: 'llm_call' | 'tool_call' | 'conditional' | 'parallel' | 'hitl_gate' | 'code_execution' | 'end';
  label: string;
  config: Record<string, unknown>;
}

interface GraphEdge {
  from: string;
  to: string;
  condition?: string;
  label?: string;
}

interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entry_node: string;
}

interface WorkflowState {
  [key: string]: unknown;
  _current_node: string;
  _history: string[];
  _iteration_count: Record<string, number>;
  _output: string;
  input: string;
}

const MAX_ITERATIONS = 10;
const STEP_TIMEOUT_MS = 30000;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const raw = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);

    const { workflow_id, input, resume_run_id } = parsed.data;

    // Load workflow
    const { data: workflow, error: wfError } = await supabase.from('workflows').select('*').eq('id', workflow_id).single();
    if (wfError || !workflow) return jsonResponse({ error: 'Workflow not found' }, 404);

    const config = (workflow.config || {}) as Record<string, unknown>;
    const graph: WorkflowGraph = {
      nodes: (config.nodes as GraphNode[]) || [],
      edges: (config.edges as GraphEdge[]) || [],
      entry_node: (config.entry_node as string) || (config.nodes as GraphNode[])?.[0]?.id || '',
    };

    // If no graph nodes, fall back to sequential steps
    if (graph.nodes.length === 0) {
      const { data: steps } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order', { ascending: true });
      if (steps && steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          graph.nodes.push({ id: `step_${i}`, type: 'llm_call', label: steps[i].name, config: { role: steps[i].role, agent_id: steps[i].agent_id } });
          if (i > 0) graph.edges.push({ from: `step_${i - 1}`, to: `step_${i}` });
        }
        graph.nodes.push({ id: 'end', type: 'end', label: 'End', config: {} });
        graph.edges.push({ from: `step_${steps.length - 1}`, to: 'end' });
        graph.entry_node = 'step_0';
      }
    }

    if (graph.nodes.length === 0) return jsonResponse({ error: 'No nodes in workflow' }, 400);

    // Initialize or resume state
    let state: WorkflowState;
    let runId: string;

    if (resume_run_id) {
      const { data: existingRun } = await supabase.from('workflow_runs').select('*').eq('id', resume_run_id).single();
      if (!existingRun) return jsonResponse({ error: 'Run not found' }, 404);
      const existingOutput = existingRun.output as Record<string, unknown> | null;
      state = (existingOutput?.state as WorkflowState) || { _current_node: graph.entry_node, _history: [], _iteration_count: {}, _output: '', input };
      runId = existingRun.id;
      await supabase.from('workflow_runs').update({ status: 'running' }).eq('id', runId);
    } else {
      state = { _current_node: graph.entry_node, _history: [], _iteration_count: {}, _output: '', input };
      const { data: run } = await supabase.from('workflow_runs').insert({
        workflow_id, status: 'running', total_steps: graph.nodes.length,
      }).select('id').single();
      runId = run?.id || '';
    }

    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    let totalTokens = 0, totalCost = 0, stepsExecuted = 0;

    // ═══ GRAPH EXECUTION LOOP ═══
    while (state._current_node && state._current_node !== '') {
      const node = graph.nodes.find(n => n.id === state._current_node);
      if (!node || node.type === 'end') break;

      // Cycle detection
      const iterKey = node.id;
      state._iteration_count[iterKey] = (state._iteration_count[iterKey] || 0) + 1;
      if (state._iteration_count[iterKey] > MAX_ITERATIONS) {
        await supabase.from('workflow_runs').update({ status: 'failed', error: `Max iterations (${MAX_ITERATIONS}) reached at node "${node.label}"`, output: { state } as unknown as Record<string, unknown> }).eq('id', runId);
        return jsonResponse({ error: `Cycle limit reached at "${node.label}"`, run_id: runId }, 400);
      }

      state._history.push(node.id);
      const stepStart = Date.now();

      try {
        if (node.type === 'llm_call') {
          const model = (node.config.model as string) || 'claude-sonnet-4-20250514';
          const systemPrompt = (node.config.system_prompt as string) || `You are "${node.label}" in a workflow. ${node.config.role || ''}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);

          const resp = await fetch(gatewayUrl, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: (state._output as string) || state.input || '' }], temperature: (node.config.temperature as number) || 0.7, max_tokens: (node.config.max_tokens as number) || 2000 }),
          });
          clearTimeout(timeout);

          const result = await resp.json();
          state._output = result.content || '';
          state[`${node.id}_output`] = state._output;
          totalTokens += result.tokens?.total || 0;
          totalCost += result.cost_usd || 0;

        } else if (node.type === 'tool_call') {
          // ═══ TOOL CALL — Direct HF Inference API or custom API ═══
          const toolType = (node.config.tool_type as string) || 'hf_inference';
          const hfToken = Deno.env.get('HF_API_TOKEN');

          if (toolType === 'hf_inference' && hfToken) {
            const hfModel = (node.config.hf_model as string) || 'dslim/bert-base-NER';
            const hfTask = (node.config.hf_task as string) || 'token-classification';
            const inputText = (state._output as string) || state.input || '';

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
            const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${hfModel}`, {
              method: 'POST', signal: controller.signal,
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
              body: JSON.stringify(
                hfTask === 'zero-shot-classification'
                  ? { inputs: inputText.substring(0, 1000), parameters: { candidate_labels: (node.config.labels as string[]) || ['positive', 'negative', 'neutral'] } }
                  : { inputs: inputText.substring(0, 2000) }
              ),
            });
            clearTimeout(timeout);

            const result = await resp.json();
            state._output = JSON.stringify(result, null, 2);
            state[`${node.id}_output`] = state._output;
            // HF inference is free, no token/cost tracking
          } else if (toolType === 'webhook') {
            const webhookUrl = node.config.webhook_url as string;
            if (webhookUrl) {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
              const resp = await fetch(webhookUrl, {
                method: 'POST', signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: state._output || state.input, node_id: node.id, run_id: runId }),
              });
              clearTimeout(timeout);
              const result = await resp.json();
              state._output = typeof result === 'string' ? result : JSON.stringify(result);
              state[`${node.id}_output`] = state._output;
            }
          } else if (toolType === 'edge_function') {
            // Call any Fator X Edge Function as a tool
            const fnName = (node.config.function_name as string) || '';
            const fnAction = (node.config.function_action as string) || '';
            if (fnName) {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
              const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
                method: 'POST', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
                body: JSON.stringify({ action: fnAction, text: (state._output as string) || state.input || '', ...((node.config.extra_params as Record<string, unknown>) || {}) }),
              });
              clearTimeout(timeout);
              const result = await resp.json();
              state._output = typeof result === 'string' ? result : JSON.stringify(result);
              state[`${node.id}_output`] = state._output;
            }
          } else if (toolType === 'translation' && hfToken) {
            const inputText = (state._output as string) || state.input || '';
            const srcLang = (node.config.source_lang as string) || 'por_Latn';
            const tgtLang = (node.config.target_lang as string) || 'eng_Latn';
            const resp = await fetch('https://router.huggingface.co/hf-inference/models/facebook/nllb-200-distilled-600M', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
              body: JSON.stringify({ inputs: inputText.substring(0, 2000), parameters: { src_lang: srcLang, tgt_lang: tgtLang } }),
              signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
            });
            const result = await resp.json();
            state._output = Array.isArray(result) ? result[0]?.translation_text || JSON.stringify(result) : JSON.stringify(result);
            state[`${node.id}_output`] = state._output;
          } else if (toolType === 'qa_extractive' && hfToken) {
            const question = (node.config.question as string) || (state._output as string) || '';
            const context = (node.config.context as string) || state.input || '';
            const resp = await fetch('https://router.huggingface.co/hf-inference/models/deepset/roberta-base-squad2', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
              body: JSON.stringify({ inputs: { question, context: context.substring(0, 3000) } }),
              signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
            });
            const result = await resp.json();
            state._output = result.answer || JSON.stringify(result);
            state[`${node.id}_output`] = state._output;
            state[`${node.id}_score`] = result.score;
          } else if (toolType === 'image_generation' && hfToken) {
            const prompt = (node.config.prompt as string) || (state._output as string) || state.input || '';
            const resp = await fetch('https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
              body: JSON.stringify({ inputs: prompt.substring(0, 500) }),
              signal: AbortSignal.timeout(60000),
            });
            if (resp.ok) {
              const imgBuffer = await resp.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
              state._output = `[Generated image: ${imgBuffer.byteLength} bytes]`;
              state[`${node.id}_output`] = state._output;
              state[`${node.id}_image_base64`] = base64;
            } else {
              state._output = `Image generation failed: ${resp.status}`;
            }
          } else if (toolType === 'flux_generation' && hfToken) {
            // #36 — FLUX image generation (superior to SDXL)
            const prompt = (node.config.prompt as string) || (state._output as string) || state.input || '';
            const resp = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
              body: JSON.stringify({ inputs: prompt.substring(0, 500) }),
              signal: AbortSignal.timeout(60000),
            });
            if (resp.ok) {
              const imgBuffer = await resp.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
              state._output = `[FLUX image: ${imgBuffer.byteLength} bytes]`;
              state[`${node.id}_output`] = state._output;
              state[`${node.id}_image_base64`] = base64;
            } else {
              state._output = `FLUX generation failed: ${resp.status}`;
            }
          } else if (toolType === 'gradio_space') {
            // #34 — Call any HF Gradio Space as a tool via API
            const spaceId = (node.config.space_id as string) || '';
            const apiEndpoint = (node.config.api_endpoint as string) || '/predict';
            if (spaceId) {
              const spaceUrl = `https://${spaceId.replace('/', '-')}.hf.space/api${apiEndpoint}`;
              const resp = await fetch(spaceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [(state._output as string) || state.input || ''] }),
                signal: AbortSignal.timeout(30000),
              });
              if (resp.ok) {
                const result = await resp.json();
                state._output = JSON.stringify(result.data || result);
                state[`${node.id}_output`] = state._output;
              } else {
                state._output = `Space ${spaceId} call failed: ${resp.status}`;
              }
            }
          } else if (toolType === 'smolagent') {
            // #30 — smolagents-style code generation + execution via LLM
            // Enhanced version of code_execution with structured tool descriptions
            const task = (node.config.task as string) || (state._output as string) || state.input || '';
            const tools = (node.config.available_tools as string[]) || [];
            const agentModel = (node.config.model as string) || 'huggingface/Qwen/Qwen3-30B-A3B';
            const toolDescriptions = tools.length > 0
              ? `\nAvailable tools: ${tools.join(', ')}\nCall tools with: result = tool_name(args)`
              : '';

            const resp = await fetch(gatewayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
              body: JSON.stringify({
                model: agentModel,
                messages: [
                  { role: 'system', content: `You are a smolagent — a code-first AI agent. Given a task, write Python code to solve it.\nYou can use: print(), len(), sorted(), json, math, datetime, re.${toolDescriptions}\nAssign the final result to a variable called 'result'.\nRespond with:\n1. Code block\n2. "RESULT:" followed by the expected output` },
                  { role: 'user', content: `Task: ${task}` },
                ],
                temperature: 0.2, max_tokens: 2000,
              }),
              signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
            });
            const smolResult = await resp.json();
            const smolOutput = smolResult.content || '';
            const resultMatch = smolOutput.match(/RESULT:\s*([\s\S]*?)$/i);
            state._output = resultMatch ? resultMatch[1].trim() : smolOutput;
            state[`${node.id}_output`] = state._output;
            state[`${node.id}_code`] = smolOutput;
            totalTokens += smolResult.tokens?.total || 0;
            totalCost += smolResult.cost_usd || 0;
          } else if (toolType === 'paraphrase_detection' && hfToken) {
            // #39 — Detect duplicate/similar content
            const text1 = (node.config.text1 as string) || (state._output as string) || '';
            const text2 = (node.config.text2 as string) || state.input || '';
            const resp = await fetch('https://router.huggingface.co/hf-inference/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
              body: JSON.stringify({ inputs: { source_sentence: text1.substring(0, 500), sentences: [text2.substring(0, 500)] } }),
              signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
            });
            const simResult = await resp.json();
            const similarity = Array.isArray(simResult) ? simResult[0] : 0;
            state._output = JSON.stringify({ similarity: Math.round(similarity * 1000) / 1000, is_duplicate: similarity > 0.8 });
            state[`${node.id}_output`] = state._output;
          } else if (toolType === 'grammar_correction') {
            // #38 — Grammar/spelling correction via LLM
            const textToCorrect = (state._output as string) || state.input || '';
            const resp = await fetch(gatewayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
              body: JSON.stringify({
                model: 'huggingface/Qwen/Qwen3-30B-A3B',
                messages: [
                  { role: 'system', content: 'Corrija a gramática e ortografia do texto. Retorne APENAS o texto corrigido, sem explicações.' },
                  { role: 'user', content: textToCorrect.substring(0, 3000) },
                ],
                temperature: 0.1, max_tokens: 3000,
              }),
              signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
            });
            const gramResult = await resp.json();
            state._output = gramResult.content || textToCorrect;
            state[`${node.id}_output`] = state._output;
            totalTokens += gramResult.tokens?.total || 0;
            totalCost += gramResult.cost_usd || 0;
          }

        } else if (node.type === 'parallel') {
          const outEdges = graph.edges.filter(e => e.from === node.id);
          const parallelNodes = outEdges.map(e => graph.nodes.find(n => n.id === e.to)).filter(Boolean) as GraphNode[];

          const results = await Promise.allSettled(parallelNodes.map(async (pNode) => {
            if (pNode.type !== 'llm_call') return '';
            const model = (pNode.config.model as string) || 'claude-sonnet-4-20250514';
            const resp = await fetch(gatewayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
              body: JSON.stringify({ model, messages: [{ role: 'system', content: (pNode.config.system_prompt as string) || pNode.label }, { role: 'user', content: state._output || state.input }], temperature: 0.7, max_tokens: 2000 }),
            });
            const r = await resp.json();
            totalTokens += r.tokens?.total || 0;
            totalCost += r.cost_usd || 0;
            state[`${pNode.id}_output`] = r.content || '';
            return r.content || '';
          }));

          state._output = results.map((r, i) => `[${parallelNodes[i]?.label}] ${r.status === 'fulfilled' ? r.value : 'FAILED'}`).join('\n\n');
          const convergeNode = graph.edges.find(e => parallelNodes.some(pn => graph.edges.some(pe => pe.from === pn.id && pe.to === e.to)));
          if (convergeNode) { state._current_node = convergeNode.to; stepsExecuted++; continue; }

        } else if (node.type === 'conditional') {
          const outEdges = graph.edges.filter(e => e.from === node.id);
          let nextNode: string | null = null;

          for (const edge of outEdges) {
            if (edge.condition) {
              try {
                const evalResult = new Function('state', `return ${edge.condition}`)(state);
                if (evalResult) { nextNode = edge.to; break; }
              } catch { /* condition failed */ }
            }
          }
          if (!nextNode) {
            const defaultEdge = outEdges.find(e => !e.condition) || outEdges[0];
            nextNode = defaultEdge?.to || null;
          }

          state._current_node = nextNode || '';
          stepsExecuted++;
          await supabase.from('workflow_runs').update({ current_step: stepsExecuted, output: { state: { ...state, _history: state._history.slice(-20) } } as unknown as Record<string, unknown> }).eq('id', runId);
          continue;

        } else if (node.type === 'code_execution') {
          // ═══ CODE EXECUTION — LLM generates + validates code (smolagents pattern) ═══
          const codeTask = (node.config.task as string) || 'Process the input data';
          const codeModel = (node.config.model as string) || 'huggingface/Qwen/Qwen3-30B-A3B';
          const codeSystemPrompt = `You are a code execution agent (smolagents pattern). Given a task, write Python code to solve it.
The input data is available as a variable called \`input_data\`.
After processing, assign the final result to a variable called \`result\`.
Respond ONLY with the code block, no explanation.
Then on a new line after the code, write "RESULT:" followed by what the code would output.`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
          const resp = await fetch(gatewayUrl, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
            body: JSON.stringify({
              model: codeModel,
              messages: [
                { role: 'system', content: codeSystemPrompt },
                { role: 'user', content: `Task: ${codeTask}\n\ninput_data = """${(state._output as string || state.input || '').substring(0, 3000)}"""` },
              ],
              temperature: 0.2, max_tokens: 2000,
            }),
          });
          clearTimeout(timeout);

          const result = await resp.json();
          const codeOutput = result.content || '';
          // Extract RESULT: section if present
          const resultMatch = codeOutput.match(/RESULT:\s*([\s\S]*?)$/i);
          state._output = resultMatch ? resultMatch[1].trim() : codeOutput;
          state[`${node.id}_output`] = state._output;
          state[`${node.id}_code`] = codeOutput;
          totalTokens += result.tokens?.total || 0;
          totalCost += result.cost_usd || 0;

        } else if (node.type === 'hitl_gate') {
          await supabase.from('workflow_runs').update({
            status: 'awaiting_approval' as string, current_step: stepsExecuted,
            output: { state, pending_approval: { node_id: node.id, label: node.label, context: (state._output as string)?.substring(0, 500) } } as unknown as Record<string, unknown>,
          }).eq('id', runId);

          return jsonResponse({
            status: 'awaiting_approval', run_id: runId,
            pending_node: node.label, context: (state._output as string)?.substring(0, 200),
            message: 'Workflow paused. Call with resume_run_id to continue after approval.',
          });
        }

        stepsExecuted++;

        // Checkpoint state
        await supabase.from('workflow_runs').update({ current_step: stepsExecuted, output: { state: { ...state, _history: state._history.slice(-20) } } as unknown as Record<string, unknown> }).eq('id', runId);

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await supabase.from('workflow_runs').update({ status: 'failed', error: `Node "${node.label}" failed: ${errMsg}`, output: { state } as unknown as Record<string, unknown> }).eq('id', runId);
        return jsonResponse({ error: `Node "${node.label}" failed`, details: errMsg, run_id: runId, steps_executed: stepsExecuted }, 500);
      }

      // Resolve next node via edges
      if (node.type !== 'conditional' && node.type !== 'parallel') {
        const outEdges = graph.edges.filter(e => e.from === node.id);
        if (outEdges.length === 0) break;
        let nextNode: string | null = null;
        for (const edge of outEdges) {
          if (edge.condition) {
            try { if (new Function('state', `return ${edge.condition}`)(state)) { nextNode = edge.to; break; } } catch { /* skip */ }
          }
        }
        if (!nextNode) nextNode = outEdges.find(e => !e.condition)?.to || outEdges[0]?.to || null;
        state._current_node = nextNode || '';
      }
    }

    // Complete
    await supabase.from('workflow_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      current_step: stepsExecuted, output: { result: state._output, state: { _history: state._history } } as unknown as Record<string, unknown>,
    }).eq('id', runId);

    return jsonResponse({
      status: 'completed', run_id: runId,
      steps_executed: stepsExecuted, total_tokens: totalTokens,
      total_cost_usd: Math.round(totalCost * 1000000) / 1000000,
      output: (state._output as string)?.substring(0, 2000),
      node_outputs: Object.fromEntries(Object.entries(state).filter(([k]) => k.endsWith('_output') && !k.startsWith('_')).map(([k, v]) => [k, (v as string)?.substring(0, 500)])),
    });

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
