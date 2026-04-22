/**
 * Code Sandbox — `src/lib/codeSandbox.ts`
 *
 * Abstração client-side para execução isolada de código (Python / JS)
 * via edge `code-interpreter-execute`. Padrão OpenAI code_interpreter,
 * AgentCore Code Interpreter, E2B sandboxes: inputs tipados + timeout
 * + quota + filesystem persistente por `sandbox_id` durante a sessão.
 *
 * O edge real roda em Firecracker microVM quando a infra estiver
 * configurada; por enquanto usa VM do Deno com `--deny-all --allow-net=api`.
 * Este módulo é estável e o upgrade de runtime fica transparente.
 */
import { supabase } from '@/integrations/supabase/client';

export type SandboxLanguage = 'python' | 'javascript' | 'typescript';

export interface SandboxExecInput {
  sandbox_id?: string; // se setado, reaproveita FS/state entre calls
  language: SandboxLanguage;
  code: string;
  stdin?: string;
  timeout_s?: number; // default 30, max 300
  memory_mb?: number; // default 512, max 2048
  /** Arquivos a materializar em /workspace antes de executar. */
  files?: Array<{ path: string; content: string; encoding?: 'utf8' | 'base64' }>;
  /** Permite requisições externas? Default false. */
  allow_network?: boolean;
  env?: Record<string, string>;
}

export interface SandboxExecResult {
  sandbox_id: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  memory_peak_mb: number;
  artifacts: Array<{ path: string; size_bytes: number; mime: string }>;
  truncated: boolean;
  error?: string;
}

const MAX_TIMEOUT_S = 300;
const MAX_MEMORY_MB = 2048;
const MAX_CODE_LENGTH = 100_000;

export class SandboxError extends Error {
  readonly reason: 'timeout' | 'oom' | 'denied' | 'runtime' | 'validation';
  constructor(reason: SandboxError['reason'], message: string) {
    super(message);
    this.name = 'SandboxError';
    this.reason = reason;
  }
}

export function validateExecInput(input: SandboxExecInput): void {
  if (!input.code || input.code.length === 0) {
    throw new SandboxError('validation', 'Código vazio');
  }
  if (input.code.length > MAX_CODE_LENGTH) {
    throw new SandboxError('validation', `Código excede ${MAX_CODE_LENGTH} chars`);
  }
  if (input.timeout_s !== undefined && (input.timeout_s < 1 || input.timeout_s > MAX_TIMEOUT_S)) {
    throw new SandboxError('validation', `timeout_s fora do range [1, ${MAX_TIMEOUT_S}]`);
  }
  if (input.memory_mb !== undefined && (input.memory_mb < 64 || input.memory_mb > MAX_MEMORY_MB)) {
    throw new SandboxError('validation', `memory_mb fora do range [64, ${MAX_MEMORY_MB}]`);
  }
}

export async function execSandbox(input: SandboxExecInput): Promise<SandboxExecResult> {
  validateExecInput(input);
  const { data, error } = await supabase.functions.invoke('code-interpreter-execute', {
    body: {
      sandbox_id: input.sandbox_id,
      language: input.language,
      code: input.code,
      stdin: input.stdin,
      timeout_s: input.timeout_s ?? 30,
      memory_mb: input.memory_mb ?? 512,
      files: input.files ?? [],
      allow_network: input.allow_network ?? false,
      env: input.env ?? {},
    },
  });
  if (error) throw new SandboxError('runtime', error.message ?? 'Edge invocation failed');
  return data as SandboxExecResult;
}

/**
 * Helper de alto nível: roda Python com um DataFrame vindo do DataHub.
 * Padrão para o agente `spec_vendas_intel`.
 */
export async function execPythonWithCsv(
  code: string,
  csv: { name: string; content: string },
  opts: { timeout_s?: number; sandbox_id?: string } = {},
): Promise<SandboxExecResult> {
  return execSandbox({
    sandbox_id: opts.sandbox_id,
    language: 'python',
    code: [
      `import pandas as pd`,
      `df = pd.read_csv('/workspace/${csv.name}')`,
      `print(f"Loaded {len(df)} rows, columns: {list(df.columns)}")`,
      '',
      code,
    ].join('\n'),
    files: [{ path: csv.name, content: csv.content }],
    timeout_s: opts.timeout_s ?? 60,
    memory_mb: 1024,
  });
}
