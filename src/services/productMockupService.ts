/**
 * Nexus Agents Studio — Product Mockup Service
 *
 * Wraps the product-mockup Edge Function — an AI image pipeline tailored
 * for Promo Brindes' core need: turning a raw product photo into clean,
 * professional commercial mockups.
 *
 * Actions exposed:
 *   generateMockup — bg removal (RMBG-2.0) + new background (FLUX.1-schnell)
 *   upscaleImage   — Swin2SR x2 super-resolution
 *   inpaintImage   — FLUX-based fallback for region edits
 *   segmentImage   — DETR panoptic segmentation
 */
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

export interface MockupStep {
  step: string;
  status: 'ok' | 'skipped' | 'error';
  details?: string;
}

// ─────────────────────────────────────────────
// generate_mockup
// ─────────────────────────────────────────────

export interface GenerateMockupOptions {
  productImageBase64: string;
  logoBase64?: string;
  backgroundPrompt?: string;
  productName?: string;
}

export interface GenerateMockupResult {
  product_clean: string;
  steps: MockupStep[];
  cost_usd: number;
}

export async function generateMockup(opts: GenerateMockupOptions): Promise<GenerateMockupResult> {
  const { data, error } = await supabase.functions.invoke('product-mockup', {
    body: {
      action: 'generate_mockup',
      product_image_base64: opts.productImageBase64,
      logo_base64: opts.logoBase64,
      background_prompt: opts.backgroundPrompt,
      product_name: opts.productName,
    },
  });
  if (error) {
    logger.error('product-mockup generate_mockup failed', { error: error.message });
    throw new Error(error.message);
  }
  return data as GenerateMockupResult;
}

// ─────────────────────────────────────────────
// upscale
// ─────────────────────────────────────────────

export interface UpscaleResult {
  image_base64: string;
  scale: number;
  model: string;
  cost_usd: number;
}

export async function upscaleImage(imageBase64: string, scale = 2): Promise<UpscaleResult> {
  const { data, error } = await supabase.functions.invoke('product-mockup', {
    body: { action: 'upscale', image_base64: imageBase64, scale },
  });
  if (error) {
    logger.error('product-mockup upscale failed', { error: error.message });
    throw new Error(error.message);
  }
  return data as UpscaleResult;
}

// ─────────────────────────────────────────────
// inpaint
// ─────────────────────────────────────────────

export interface InpaintOptions {
  imageBase64: string;
  maskBase64: string;
  prompt: string;
}

export interface InpaintResult {
  image_base64: string;
  prompt: string;
  model: string;
  note?: string;
  cost_usd: number;
}

export async function inpaintImage(opts: InpaintOptions): Promise<InpaintResult> {
  const { data, error } = await supabase.functions.invoke('product-mockup', {
    body: {
      action: 'inpaint',
      image_base64: opts.imageBase64,
      mask_base64: opts.maskBase64,
      prompt: opts.prompt,
    },
  });
  if (error) {
    logger.error('product-mockup inpaint failed', { error: error.message });
    throw new Error(error.message);
  }
  return data as InpaintResult;
}

// ─────────────────────────────────────────────
// segment
// ─────────────────────────────────────────────

export interface SegmentEntry {
  label: string;
  score: number;
}

export interface SegmentResult {
  segments: SegmentEntry[];
  model: string;
  note?: string;
  cost_usd: number;
}

export async function segmentImage(imageBase64: string): Promise<SegmentResult> {
  const { data, error } = await supabase.functions.invoke('product-mockup', {
    body: { action: 'segment', image_base64: imageBase64 },
  });
  if (error) {
    logger.error('product-mockup segment failed', { error: error.message });
    throw new Error(error.message);
  }
  return data as SegmentResult;
}

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Convert a File/Blob to a raw base64 string (no data: prefix). 10MB cap. */
export async function imageToBase64(file: File | Blob): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Imagem excede 10MB');
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.readAsDataURL(file);
  });
}

/** Build a `data:image/png;base64,...` URL ready for an <img src=...>. */
export function base64ToDataUrl(base64: string, mime = 'image/png'): string {
  return `data:${mime};base64,${base64}`;
}
