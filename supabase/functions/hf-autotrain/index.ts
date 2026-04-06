import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCorsHeaders, handleCorsPreflight, jsonResponse, errorResponse, checkRateLimit, getRateLimitIdentifier, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

// CORS handled by _shared/cors.ts — dynamic origin whitelist

// jsonResponse imported from _shared/mod.ts — uses getCorsHeaders(req)

// ═══ Zod Schemas ═══
const ActionSchema = z.object({
  action: z.enum(['prepare_dataset', 'start_training', 'check_status', 'list_models', 'export_traces', 'prepare_dpo_dataset', 'generate_trl_config']),
  agent_id: z.string().uuid().optional(),
  dataset_config: z.object({
    source: z.enum(['traces', 'test_cases', 'custom']).optional(),
    min_quality_score: z.number().min(0).max(5).optional(),
    max_samples: z.number().int().min(10).max(10000).optional(),
    task_type: z.enum(['text-classification', 'text-generation', 'embedding', 'reranking']).optional(),
  }).optional(),
  training_config: z.object({
    base_model: z.string().max(200).optional(),
    task: z.enum(['text-classification', 'text-generation', 'embedding']).optional(),
    epochs: z.number().int().min(1).max(20).optional(),
    learning_rate: z.number().min(0.000001).max(0.01).optional(),
    repo_name: z.string().max(100).optional(),
  }).optional(),
  job_id: z.string().max(100).optional(),
});

const HF_AUTOTRAIN_API = 'https://huggingface.co/api/autotrain';

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse(req, { error: 'Unauthorized' }, 401);

    const rawBody = await req.json();
    const parsed = ActionSchema.safeParse(rawBody);
    if (!parsed.success) return jsonResponse(req, { error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);

    const { action, agent_id, dataset_config, training_config, job_id } = parsed.data;
    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return jsonResponse(req, { error: 'HF_API_TOKEN not configured' }, 400);

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    // ═══ ACTION: export_traces — Export agent traces as training data ═══
    if (action === 'export_traces') {
      if (!agent_id) return jsonResponse(req, { error: 'agent_id required' }, 400);

      const minScore = dataset_config?.min_quality_score || 3;
      const maxSamples = dataset_config?.max_samples || 1000;

      // Get successful traces with good scores
      const { data: traces, error } = await supabase
        .from('agent_traces')
        .select('input, output, metadata, cost_usd')
        .eq('agent_id', agent_id)
        .eq('event', 'llm_call')
        .eq('level', 'info')
        .order('created_at', { ascending: false })
        .limit(maxSamples);

      if (error) throw new Error(error.message);

      // Transform to instruction-following format
      const dataset = (traces || [])
        .filter((t: Record<string, unknown>) => {
          const input = t.input as Record<string, unknown> | null;
          const output = t.output as Record<string, unknown> | null;
          return input?.user_message && output?.content;
        })
        .map((t: Record<string, unknown>) => {
          const input = t.input as Record<string, unknown>;
          const output = t.output as Record<string, unknown>;
          return {
            instruction: String(input.user_message || ''),
            output: String(output.content || ''),
            input: '', // empty for instruction-following
          };
        });

      return jsonResponse(req, {
        dataset_size: dataset.length,
        format: 'alpaca',
        sample: dataset.slice(0, 3),
        dataset, // full dataset for download
        agent_id,
      });
    }

    // ═══ ACTION: prepare_dataset — Prepare and validate dataset for training ═══
    if (action === 'prepare_dataset') {
      if (!agent_id) return jsonResponse(req, { error: 'agent_id required' }, 400);

      const taskType = dataset_config?.task_type || 'text-generation';
      const maxSamples = dataset_config?.max_samples || 500;

      let dataset: Array<Record<string, string>> = [];

      if (taskType === 'text-generation') {
        // Get traces as instruction-output pairs
        const { data: traces } = await supabase
          .from('agent_traces')
          .select('input, output')
          .eq('agent_id', agent_id)
          .eq('event', 'llm_call')
          .eq('level', 'info')
          .order('created_at', { ascending: false })
          .limit(maxSamples);

        dataset = (traces || [])
          .filter((t: any) => t.input?.user_message && t.output?.content)
          .map((t: any) => ({
            text: `<s>[INST] ${t.input.user_message} [/INST] ${t.output.content}</s>`,
          }));
      } else if (taskType === 'text-classification') {
        // Get traces with auto_category from zero-shot classification
        const { data: traces } = await supabase
          .from('agent_traces')
          .select('input, metadata')
          .eq('agent_id', agent_id)
          .not('metadata->auto_category', 'is', null)
          .order('created_at', { ascending: false })
          .limit(maxSamples);

        dataset = (traces || [])
          .filter((t: any) => t.input?.user_message && t.metadata?.auto_category)
          .map((t: any) => ({
            text: t.input.user_message,
            label: t.metadata.auto_category,
          }));
      }

      // Validation
      const issues: string[] = [];
      if (dataset.length < 50) issues.push(`Dataset muito pequeno: ${dataset.length} amostras (mínimo recomendado: 50)`);
      if (dataset.length < 10) issues.push('CRÍTICO: Menos de 10 amostras. Fine-tuning não é viável.');

      return jsonResponse(req, {
        status: issues.length === 0 ? 'ready' : 'warning',
        dataset_size: dataset.length,
        task_type: taskType,
        format: taskType === 'text-generation' ? 'chatml' : 'csv',
        issues,
        sample: dataset.slice(0, 3),
        dataset,
      });
    }

    // ═══ ACTION: start_training — Create AutoTrain job on HuggingFace ═══
    if (action === 'start_training') {
      const baseModel = training_config?.base_model || 'mistralai/Mistral-7B-Instruct-v0.3';
      const task = training_config?.task || 'text-generation';
      const epochs = training_config?.epochs || 3;
      const lr = training_config?.learning_rate || 0.00002;
      const repoName = training_config?.repo_name || `fatorx-finetune-${Date.now()}`;

      // Check HF user
      const whoResp = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { 'Authorization': `Bearer ${hfToken}` },
      });
      const whoami = await whoResp.json();
      const hfUsername = whoami.name;

      // Create HF repo for the model
      const repoResp = await fetch('https://huggingface.co/api/repos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
        body: JSON.stringify({ name: repoName, type: 'model', private: true }),
      });

      const repoResult = await repoResp.json();

      // Store training job info in database
      if (wsId) {
        await (supabase as any).from('agent_traces').insert({
          agent_id: agent_id || '00000000-0000-0000-0000-000000000000',
          user_id: user.id,
          workspace_id: wsId,
          event: 'finetune_started',
          level: 'info',
          input: { base_model: baseModel, task, epochs, learning_rate: lr },
          output: { repo: `${hfUsername}/${repoName}`, status: 'repo_created' },
          metadata: { hf_repo: `${hfUsername}/${repoName}`, training_config },
        });
      }

      return jsonResponse(req, {
        status: 'repo_created',
        repo_id: `${hfUsername}/${repoName}`,
        repo_url: `https://huggingface.co/${hfUsername}/${repoName}`,
        base_model: baseModel,
        task,
        config: { epochs, learning_rate: lr },
        next_steps: [
          'Upload the prepared dataset to the repo',
          'Configure AutoTrain via HF web interface or API',
          'Monitor training progress at the repo URL',
          'Once complete, use the model as huggingface/' + hfUsername + '/' + repoName + ' in the LLM Gateway',
        ],
      });
    }

    // ═══ ACTION: list_models — List fine-tuned models on HF ═══
    if (action === 'list_models') {
      const whoResp = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { 'Authorization': `Bearer ${hfToken}` },
      });
      const whoami = await whoResp.json();
      const hfUsername = whoami.name;

      const modelsResp = await fetch(`https://huggingface.co/api/models?author=${hfUsername}&sort=lastModified&direction=-1&limit=20`, {
        headers: { 'Authorization': `Bearer ${hfToken}` },
      });
      const models = await modelsResp.json();

      return jsonResponse(req, {
        hf_username: hfUsername,
        models: (models || []).map((m: Record<string, unknown>) => ({
          id: m.id,
          name: (m.id as string)?.split('/')?.pop(),
          private: m.private,
          downloads: m.downloads,
          updated: m.lastModified,
          tags: m.tags,
          gateway_model_id: `huggingface/${m.id}`,
        })),
      });
    }

    // ═══ ACTION: check_status — Check training job status ═══
    if (action === 'check_status') {
      if (!job_id) return jsonResponse(req, { error: 'job_id (repo_id) required' }, 400);

      const repoResp = await fetch(`https://huggingface.co/api/models/${job_id}`, {
        headers: { 'Authorization': `Bearer ${hfToken}` },
      });

      if (!repoResp.ok) return jsonResponse(req, { error: 'Model not found', job_id }, 404);
      const repoData = await repoResp.json();

      // Check if model files exist (indicates training completion)
      const filesResp = await fetch(`https://huggingface.co/api/models/${job_id}/tree/main`, {
        headers: { 'Authorization': `Bearer ${hfToken}` },
      });
      const files = filesResp.ok ? await filesResp.json() : [];
      const hasModelFiles = (files || []).some((f: Record<string, unknown>) => {
        const fname = String(f.path || '');
        return fname.endsWith('.safetensors') || fname.endsWith('.bin') || fname === 'config.json';
      });

      return jsonResponse(req, {
        job_id,
        status: hasModelFiles ? 'completed' : 'pending',
        model_url: `https://huggingface.co/${job_id}`,
        has_model_files: hasModelFiles,
        file_count: (files || []).length,
        last_modified: repoData.lastModified,
        downloads: repoData.downloads,
        gateway_model_id: hasModelFiles ? `huggingface/${job_id}` : null,
      });
    }

    // ═══ ACTION: prepare_dpo_dataset — Prepare DPO preference dataset from user feedback (#55) ═══
    if (action === 'prepare_dpo_dataset') {
      if (!agent_id) return jsonResponse(req, { error: 'agent_id required' }, 400);

      // Get traces with user feedback (thumbs up/down from chat interface)
      const { data: posTraces } = await supabase
        .from('agent_traces')
        .select('input, output, metadata')
        .eq('agent_id', agent_id)
        .eq('level', 'info')
        .not('metadata->user_feedback', 'is', null)
        .order('created_at', { ascending: false })
        .limit(dataset_config?.max_samples || 500);

      // Build DPO pairs: chosen (positive feedback) vs rejected (negative or regenerated)
      const dpoPairs: Array<Record<string, string>> = [];
      const traces = posTraces || [];

      for (const trace of traces) {
        const input = trace.input as Record<string, unknown> | null;
        const output = trace.output as Record<string, unknown> | null;
        const meta = trace.metadata as Record<string, unknown> | null;

        if (!input?.user_message || !output?.content) continue;

        const feedback = meta?.user_feedback as string;
        if (feedback === 'positive') {
          dpoPairs.push({
            prompt: String(input.user_message),
            chosen: String(output.content),
            rejected: '', // Will be filled by regeneration or paired with negative examples
          });
        } else if (feedback === 'negative') {
          // Find a positive response for the same type of question
          dpoPairs.push({
            prompt: String(input.user_message),
            chosen: '', // Needs positive pair
            rejected: String(output.content),
          });
        }
      }

      // Filter complete pairs (both chosen and rejected present)
      const completePairs = dpoPairs.filter(p => p.chosen && p.rejected);
      // Partial pairs can be completed by generating alternatives via LLM
      const partialPairs = dpoPairs.filter(p => !p.chosen || !p.rejected);

      return jsonResponse(req, {
        status: completePairs.length >= 10 ? 'ready' : 'insufficient',
        complete_pairs: completePairs.length,
        partial_pairs: partialPairs.length,
        total_feedback_traces: traces.length,
        format: 'dpo',
        dataset: completePairs,
        partial: partialPairs.slice(0, 5),
        note: completePairs.length < 10
          ? 'Need at least 10 complete preference pairs. Collect more user feedback (thumbs up/down) or use LLM to generate rejected alternatives.'
          : 'Dataset ready for DPO training via TRL v1.0',
        trl_command: completePairs.length >= 10
          ? `trl dpo --model_name ./sft --dataset_name ./dpo_dataset --output_dir ./dpo_aligned`
          : undefined,
      });
    }

    // ═══ ACTION: generate_trl_config — Generate TRL v1.0 training config (#55) ═══
    if (action === 'generate_trl_config') {
      const baseModel = training_config?.base_model || 'mistralai/Mistral-7B-Instruct-v0.3';
      const task = training_config?.task || 'text-generation';
      const epochs = training_config?.epochs || 3;
      const lr = training_config?.learning_rate || 0.00002;

      const trlConfig = {
        sft: {
          command: `trl sft --model_name ${baseModel} --dataset_name ./dataset --output_dir ./sft --num_train_epochs ${epochs} --learning_rate ${lr} --per_device_train_batch_size 4 --gradient_accumulation_steps 4 --logging_steps 10`,
          description: 'Supervised Fine-Tuning with agent traces',
        },
        dpo: {
          command: `trl dpo --model_name ./sft --dataset_name ./dpo_dataset --output_dir ./dpo --beta 0.1 --learning_rate ${lr / 10} --num_train_epochs 1`,
          description: 'Direct Preference Optimization with user feedback',
        },
        grpo: {
          command: `trl grpo --model_name ./sft --dataset_name ./grpo_dataset --output_dir ./grpo --num_train_epochs 1`,
          description: 'Group Relative Policy Optimization (DeepSeek R1 method)',
        },
        reward: {
          command: `trl reward --model_name ${baseModel} --dataset_name ./reward_dataset --output_dir ./reward_model`,
          description: 'Train reward model for quality scoring',
        },
      };

      return jsonResponse(req, {
        trl_version: '1.0',
        base_model: baseModel,
        task,
        configs: trlConfig,
        pipeline: [
          '1. export_traces → coleta dados do agente',
          '2. prepare_dataset → formata para SFT',
          '3. SFT → treina modelo base com traces',
          '4. prepare_dpo_dataset → coleta feedback dos usuários',
          '5. DPO → alinha com preferências humanas',
          '6. Deploy → usa modelo alinhado no LLM Gateway como huggingface/user/model',
        ],
        requirements: 'pip install trl>=1.0.0 transformers>=5.0.0 peft accelerate',
      });
    }

    return jsonResponse(req, { error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
