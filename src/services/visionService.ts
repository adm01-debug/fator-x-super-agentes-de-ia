/**
 * Nexus Agents Studio — Vision Service
 *
 * Wraps the image-analysis Edge Function: a single endpoint that
 * routes between NSFW check, classification and vision-LLM analysis.
 *
 * Backed by HuggingFace Inference API:
 *   - Falconsai/nsfw_image_detection (nsfw_check)
 *   - google/vit-base-patch16-224 (classify)
 *   - ibm-granite/granite-vision-3.3-2b (analyze, default)
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export type VisionAction = 'analyze' | 'classify' | 'nsfw_check' | 'mockup' | 'compare';

export interface VisionInvokeOptions {
  action?: VisionAction;
  imageBase64?: string;
  imageUrl?: string;
  prompt?: string;
  categories?: string[];
}

export interface VisionRawResponse {
  action: VisionAction;
  result: unknown;
  model_used: string;
}

async function invokeVision(opts: VisionInvokeOptions): Promise<VisionRawResponse> {
  if (!opts.imageBase64 && !opts.imageUrl) {
    throw new Error('Forneça imageBase64 ou imageUrl');
  }
  const { data, error } = await supabase.functions.invoke('image-analysis', {
    body: {
      action: opts.action ?? 'analyze',
      image_base64: opts.imageBase64,
      image_url: opts.imageUrl,
      prompt: opts.prompt,
      categories: opts.categories,
    },
  });
  if (error) {
    logger.error('image-analysis failed', { action: opts.action, error: error.message });
    throw new Error(error.message);
  }
  return data as VisionRawResponse;
}

// ─────────────────────────────────────────────
// analyze (vision LLM)
// ─────────────────────────────────────────────

export interface AnalyzeResult {
  analysis: string;
}

export async function analyzeImage(opts: {
  imageBase64?: string;
  imageUrl?: string;
  prompt?: string;
}): Promise<AnalyzeResult> {
  const data = await invokeVision({ ...opts, action: 'analyze' });
  const result = data.result as { analysis?: string };
  return { analysis: result.analysis ?? '' };
}

// ─────────────────────────────────────────────
// classify (image classification)
// ─────────────────────────────────────────────

export interface ClassifyEntry {
  label: string;
  score: number;
}

export async function classifyImage(opts: {
  imageBase64?: string;
  imageUrl?: string;
}): Promise<ClassifyEntry[]> {
  const data = await invokeVision({ ...opts, action: 'classify' });
  const raw = data.result;
  if (!Array.isArray(raw)) return [];
  return (raw as Array<{ label?: string; score?: number }>).map((r) => ({
    label: String(r.label ?? 'unknown'),
    score: typeof r.score === 'number' ? r.score : 0,
  }));
}

// ─────────────────────────────────────────────
// nsfw_check
// ─────────────────────────────────────────────

export interface NsfwCheckResult {
  is_nsfw: boolean;
  scores: ClassifyEntry[];
}

export async function checkNsfw(opts: {
  imageBase64?: string;
  imageUrl?: string;
}): Promise<NsfwCheckResult> {
  const data = await invokeVision({ ...opts, action: 'nsfw_check' });
  const raw = data.result;
  const scores: ClassifyEntry[] = Array.isArray(raw)
    ? (raw as Array<{ label?: string; score?: number }>).map((r) => ({
        label: String(r.label ?? 'unknown'),
        score: typeof r.score === 'number' ? r.score : 0,
      }))
    : [];
  const nsfwEntry = scores.find((s) => s.label.toLowerCase() === 'nsfw');
  const safeEntry = scores.find((s) => s.label.toLowerCase() === 'normal');
  const is_nsfw = !!nsfwEntry && nsfwEntry.score > (safeEntry?.score ?? 0);
  return { is_nsfw, scores };
}
