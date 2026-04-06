import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCorsHeaders, handleCorsPreflight, errorResponse } from "../_shared/mod.ts";

function hfJsonResponse(req: Request, data: unknown, status = 200) {
  const cors = getCorsHeaders(req);
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return hfJsonResponse(req, { error: 'Unauthorized' }, 401);

    const rawBody = await req.json();
    const parsed = ActionSchema.safeParse(rawBody);
    if (!parsed.success) return hfJsonResponse(req, { error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);

    const { action, agent_id, dataset_config, training_config, job_id } = parsed.data;
    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return hfJsonResponse(req, { error: 'HF_API_TOKEN not configured' }, 400);

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    if (action === 'export_traces') {
      if (!agent_id) return hfJsonResponse(req, { error: 'agent_id required' }, 400);
      const minScore = dataset_config?.min_quality_score || 3;
      const maxSamples = dataset_config?.max_samples || 1000;
      const { data: traces, error } = await supabase
        .from('agent_traces').select('input, output, metadata, cost_usd')
        .eq('agent_id', agent_id).eq('event', 'llm_call').eq('level', 'info')
        .order('created_at', { ascending: false }).limit(maxSamples);
      if (error) throw new Error(error.message);
      // deno-lint-ignore no-explicit-any
      const dataset = (traces || []).filter((t: any) => t.input?.user_message && t.output?.content)
        // deno-lint-ignore no-explicit-any
        .map((t: any) => ({ instruction: String(t.input.user_message || ''), output: String(t.output.content || ''), input: '' }));
      return hfJsonResponse(req, { dataset_size: dataset.length, format: 'alpaca', sample: dataset.slice(0, 3), dataset, agent_id });
    }

    if (action === 'prepare_dataset') {
      if (!agent_id) return hfJsonResponse(req, { error: 'agent_id required' }, 400);
      const taskType = dataset_config?.task_type || 'text-generation';
      const maxSamples = dataset_config?.max_samples || 500;
      // deno-lint-ignore no-explicit-any
      let dataset: Array<Record<string, string>> = [];
      if (taskType === 'text-generation') {
        const { data: traces } = await supabase.from('agent_traces').select('input, output')
          .eq('agent_id', agent_id).eq('event', 'llm_call').eq('level', 'info')
          .order('created_at', { ascending: false }).limit(maxSamples);
        // deno-lint-ignore no-explicit-any
        dataset = (traces || []).filter((t: any) => t.input?.user_message && t.output?.content)
          // deno-lint-ignore no-explicit-any
          .map((t: any) => ({ text: `<s>[INST] ${t.input.user_message} [/INST] ${t.output.content}</s>` }));
      } else if (taskType === 'text-classification') {
        const { data: traces } = await supabase.from('agent_traces').select('input, metadata')
          .eq('agent_id', agent_id).not('metadata->auto_category', 'is', null)
          .order('created_at', { ascending: false }).limit(maxSamples);
        // deno-lint-ignore no-explicit-any
        dataset = (traces || []).filter((t: any) => t.input?.user_message && t.metadata?.auto_category)
          // deno-lint-ignore no-explicit-any
          .map((t: any) => ({ text: t.input.user_message, label: t.metadata.auto_category }));
      }
      const issues: string[] = [];
      if (dataset.length < 50) issues.push(`Dataset muito pequeno: ${dataset.length} amostras (mínimo recomendado: 50)`);
      if (dataset.length < 10) issues.push('CRÍTICO: Menos de 10 amostras. Fine-tuning não é viável.');
      return hfJsonResponse(req, { status: issues.length === 0 ? 'ready' : 'warning', dataset_size: dataset.length, task_type: taskType, format: taskType === 'text-generation' ? 'chatml' : 'csv', issues, sample: dataset.slice(0, 3), dataset });
    }

    if (action === 'start_training') {
      const baseModel = training_config?.base_model || 'mistralai/Mistral-7B-Instruct-v0.3';
      const task = training_config?.task || 'text-generation';
      const epochs = training_config?.epochs || 3;
      const lr = training_config?.learning_rate || 0.00002;
      const repoName = training_config?.repo_name || `fatorx-finetune-${Date.now()}`;
      const whoResp = await fetch('https://huggingface.co/api/whoami-v2', { headers: { 'Authorization': `Bearer ${hfToken}` } });
      const whoami = await whoResp.json();
      const hfUsername = (whoami as Record<string, string>).name;
      await fetch('https://huggingface.co/api/repos/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
        body: JSON.stringify({ name: repoName, type: 'model', private: true }),
      });
      if (wsId) {
        // deno-lint-ignore no-explicit-any
        await (supabase as any).from('agent_traces').insert({
          agent_id: agent_id || '00000000-0000-0000-0000-000000000000', user_id: user.id,
          event: 'finetune_started', level: 'info',
          input: { base_model: baseModel, task, epochs, learning_rate: lr },
          output: { repo: `${hfUsername}/${repoName}`, status: 'repo_created' },
          metadata: { hf_repo: `${hfUsername}/${repoName}`, training_config },
        });
      }
      return hfJsonResponse(req, {
        status: 'repo_created', repo_id: `${hfUsername}/${repoName}`,
        repo_url: `https://huggingface.co/${hfUsername}/${repoName}`,
        base_model: baseModel, task, config: { epochs, learning_rate: lr },
        next_steps: ['Upload the prepared dataset to the repo', 'Configure AutoTrain via HF web interface or API', 'Monitor training progress at the repo URL', 'Once complete, use the model as huggingface/' + hfUsername + '/' + repoName + ' in the LLM Gateway'],
      });
    }

    if (action === 'list_models') {
      const whoResp = await fetch('https://huggingface.co/api/whoami-v2', { headers: { 'Authorization': `Bearer ${hfToken}` } });
      const whoami = await whoResp.json();
      const hfUsername = (whoami as Record<string, string>).name;
      const modelsResp = await fetch(`https://huggingface.co/api/models?author=${hfUsername}&sort=lastModified&direction=-1&limit=20`, { headers: { 'Authorization': `Bearer ${hfToken}` } });
      const models = await modelsResp.json();
      return hfJsonResponse(req, {
        hf_username: hfUsername,
        // deno-lint-ignore no-explicit-any
        models: (models as any[] || []).map((m: Record<string, unknown>) => ({
          id: m.id, name: (m.id as string)?.split('/')?.pop(), private: m.private,
          downloads: m.downloads, updated: m.lastModified, tags: m.tags,
          gateway_model_id: `huggingface/${m.id}`,
        })),
      });
    }

    if (action === 'check_status') {
      if (!job_id) return hfJsonResponse(req, { error: 'job_id (repo_id) required' }, 400);
      const repoResp = await fetch(`https://huggingface.co/api/models/${job_id}`, { headers: { 'Authorization': `Bearer ${hfToken}` } });
      if (!repoResp.ok) return hfJsonResponse(req, { error: 'Model not found', job_id }, 404);
      const repoData = await repoResp.json() as Record<string, unknown>;
      const filesResp = await fetch(`https://huggingface.co/api/models/${job_id}/tree/main`, { headers: { 'Authorization': `Bearer ${hfToken}` } });
      const files = filesResp.ok ? await filesResp.json() as Array<Record<string, unknown>> : [];
      const hasModelFiles = files.some((f) => {
        const fname = String(f.path || '');
        return fname.endsWith('.safetensors') || fname.endsWith('.bin') || fname === 'config.json';
      });
      return hfJsonResponse(req, {
        job_id, status: hasModelFiles ? 'completed' : 'pending',
        model_url: `https://huggingface.co/${job_id}`, has_model_files: hasModelFiles,
        file_count: files.length, last_modified: repoData.lastModified, downloads: repoData.downloads,
        gateway_model_id: hasModelFiles ? `huggingface/${job_id}` : null,
      });
    }

    if (action === 'prepare_dpo_dataset') {
      if (!agent_id) return hfJsonResponse(req, { error: 'agent_id required' }, 400);
      const { data: posTraces } = await supabase.from('agent_traces').select('input, output, metadata')
        .eq('agent_id', agent_id).eq('level', 'info').not('metadata->user_feedback', 'is', null)
        .order('created_at', { ascending: false }).limit(dataset_config?.max_samples || 500);
      const dpoPairs: Array<Record<string, string>> = [];
      for (const trace of posTraces || []) {
        const input = trace.input as Record<string, unknown> | null;
        const output = trace.output as Record<string, unknown> | null;
        const meta = trace.metadata as Record<string, unknown> | null;
        if (!input?.user_message || !output?.content) continue;
        const feedback = meta?.user_feedback as string;
        if (feedback === 'positive') dpoPairs.push({ prompt: String(input.user_message), chosen: String(output.content), rejected: '' });
        else if (feedback === 'negative') dpoPairs.push({ prompt: String(input.user_message), chosen: '', rejected: String(output.content) });
      }
      const completePairs = dpoPairs.filter(p => p.chosen && p.rejected);
      const partialPairs = dpoPairs.filter(p => !p.chosen || !p.rejected);
      return hfJsonResponse(req, {
        status: completePairs.length >= 10 ? 'ready' : 'insufficient',
        complete_pairs: completePairs.length, partial_pairs: partialPairs.length,
        total_feedback_traces: (posTraces || []).length, format: 'dpo',
        dataset: completePairs, partial: partialPairs.slice(0, 5),
        note: completePairs.length < 10 ? 'Need at least 10 complete preference pairs.' : 'Dataset ready for DPO training via TRL v1.0',
        trl_command: completePairs.length >= 10 ? `trl dpo --model_name ./sft --dataset_name ./dpo_dataset --output_dir ./dpo_aligned` : undefined,
      });
    }

    if (action === 'generate_trl_config') {
      const baseModel = training_config?.base_model || 'mistralai/Mistral-7B-Instruct-v0.3';
      const epochs = training_config?.epochs || 3;
      const lr = training_config?.learning_rate || 0.00002;
      const trlConfig = {
        sft: { command: `trl sft --model_name ${baseModel} --dataset_name ./dataset --output_dir ./sft --num_train_epochs ${epochs} --learning_rate ${lr} --per_device_train_batch_size 4 --gradient_accumulation_steps 4 --logging_steps 10`, description: 'Supervised Fine-Tuning with agent traces' },
        dpo: { command: `trl dpo --model_name ./sft --dataset_name ./dpo_dataset --output_dir ./dpo --beta 0.1 --learning_rate ${lr / 10} --num_train_epochs 1`, description: 'Direct Preference Optimization with user feedback' },
        grpo: { command: `trl grpo --model_name ./sft --dataset_name ./grpo_dataset --output_dir ./grpo --num_train_epochs 1`, description: 'Group Relative Policy Optimization (DeepSeek R1 method)' },
        reward: { command: `trl reward --model_name ${baseModel} --dataset_name ./reward_dataset --output_dir ./reward_model`, description: 'Train reward model for quality scoring' },
      };
      return hfJsonResponse(req, {
        trl_version: '1.0', base_model: baseModel, task: training_config?.task || 'text-generation',
        configs: trlConfig,
        pipeline: ['1. export_traces', '2. prepare_dataset', '3. SFT', '4. prepare_dpo_dataset', '5. DPO', '6. Deploy'],
        requirements: 'pip install trl>=1.0.0 transformers>=5.0.0 peft accelerate',
      });
    }

    return hfJsonResponse(req, { error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
