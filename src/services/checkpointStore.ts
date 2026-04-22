/**
 * Checkpoint Store — `src/services/checkpointStore.ts`
 *
 * Durable execution layer: persiste o estado parcial de um agent run
 * em `public.agent_checkpoints` (JSONB) indexado por `thread_id` +
 * `checkpoint_id`. Permite retomar após crash, time-travel debugging
 * e fork de qualquer ponto histórico — padrão LangGraph `PostgresSaver`.
 *
 * Esquema esperado (migration a aplicar):
 *   agent_checkpoints(
 *     id uuid PK default gen_random_uuid(),
 *     workspace_id uuid,
 *     thread_id text NOT NULL,
 *     agent_id uuid NOT NULL,
 *     checkpoint_id text NOT NULL,     -- ex: "step_3" ou `ulid()`
 *     parent_checkpoint_id text,
 *     step_index int NOT NULL,
 *     state jsonb NOT NULL,
 *     metadata jsonb,                  -- latency, tool_calls, etc.
 *     created_at timestamptz default now(),
 *     UNIQUE(thread_id, checkpoint_id)
 *   )
 *
 * Enquanto a migration não roda, o serviço degrada gracefully: leituras
 * devolvem [], escritas fazem log de warning. Assim o código já pode ser
 * consumido hoje em modo no-op e ativado quando o DB migrar.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface Checkpoint<TState = Record<string, unknown>> {
  id: string;
  thread_id: string;
  agent_id: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  step_index: number;
  state: TState;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SaveCheckpointInput<TState = Record<string, unknown>> {
  thread_id: string;
  agent_id: string;
  checkpoint_id?: string;
  parent_checkpoint_id?: string;
  step_index: number;
  state: TState;
  metadata?: Record<string, unknown>;
  workspace_id?: string;
}

const TABLE = 'agent_checkpoints' as const;

function makeCheckpointId(step_index: number): string {
  return `ck_${step_index}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveCheckpoint<TState = Record<string, unknown>>(
  input: SaveCheckpointInput<TState>,
): Promise<Checkpoint<TState> | null> {
  const payload = {
    workspace_id: input.workspace_id ?? null,
    thread_id: input.thread_id,
    agent_id: input.agent_id,
    checkpoint_id: input.checkpoint_id ?? makeCheckpointId(input.step_index),
    parent_checkpoint_id: input.parent_checkpoint_id ?? null,
    step_index: input.step_index,
    state: input.state as unknown as Record<string, unknown>,
    metadata: input.metadata ?? null,
  };
  const { data, error } = await supabase
    .from(TABLE as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) {
    logger.warn('checkpointStore.saveCheckpoint failed (tabela ausente?)', {
      error: error.message,
    });
    return null;
  }
  return data as unknown as Checkpoint<TState>;
}

export async function listCheckpoints(thread_id: string, limit = 50): Promise<Checkpoint[]> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select('*')
    .eq('thread_id', thread_id)
    .order('step_index', { ascending: true })
    .limit(limit);
  if (error) {
    logger.warn('checkpointStore.listCheckpoints failed', { error: error.message });
    return [];
  }
  return (data ?? []) as unknown as Checkpoint[];
}

export async function getCheckpoint(checkpoint_id: string): Promise<Checkpoint | null> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select('*')
    .eq('checkpoint_id', checkpoint_id)
    .maybeSingle();
  if (error) {
    logger.warn('checkpointStore.getCheckpoint failed', { error: error.message });
    return null;
  }
  return (data as unknown as Checkpoint) ?? null;
}

/**
 * Retoma execução a partir de um checkpoint — devolve o estado no ponto
 * exato + o próximo step_index sugerido. O caller injeta esse estado no
 * próximo turn do agente (via `smolagent-runtime` com `resume_from`).
 */
export async function resumeFrom(
  checkpoint_id: string,
): Promise<{ state: Record<string, unknown>; next_step: number } | null> {
  const ck = await getCheckpoint(checkpoint_id);
  if (!ck) return null;
  return { state: ck.state, next_step: ck.step_index + 1 };
}

/**
 * Fork: cria um novo thread partindo de um checkpoint histórico.
 * Útil para A/B de prompts a partir do mesmo ponto ou para debugging
 * "what if" — reusa o campo `parent_checkpoint_id` para montar DAG.
 */
export async function forkFromCheckpoint(
  checkpoint_id: string,
  new_thread_id: string,
  override_state?: Record<string, unknown>,
): Promise<Checkpoint | null> {
  const ck = await getCheckpoint(checkpoint_id);
  if (!ck) return null;
  return saveCheckpoint({
    thread_id: new_thread_id,
    agent_id: ck.agent_id,
    parent_checkpoint_id: ck.checkpoint_id,
    step_index: ck.step_index,
    state: override_state ?? ck.state,
    metadata: { forked_from: checkpoint_id, forked_at: new Date().toISOString() },
  });
}

// ═══ In-memory fallback (dev/test) ═════════════════════════════
const memoryStore = new Map<string, Checkpoint[]>();

export const _memoryCheckpointAdapter = {
  save<TState>(input: SaveCheckpointInput<TState>): Checkpoint<TState> {
    const ck: Checkpoint<TState> = {
      id: crypto.randomUUID(),
      thread_id: input.thread_id,
      agent_id: input.agent_id,
      checkpoint_id: input.checkpoint_id ?? makeCheckpointId(input.step_index),
      parent_checkpoint_id: input.parent_checkpoint_id ?? null,
      step_index: input.step_index,
      state: input.state,
      metadata: input.metadata ?? null,
      created_at: new Date().toISOString(),
    };
    const list = memoryStore.get(input.thread_id) ?? [];
    list.push(ck as unknown as Checkpoint);
    memoryStore.set(input.thread_id, list);
    return ck;
  },
  list(thread_id: string): Checkpoint[] {
    return (memoryStore.get(thread_id) ?? []).slice();
  },
  get(checkpoint_id: string): Checkpoint | null {
    for (const list of memoryStore.values()) {
      const hit = list.find((c) => c.checkpoint_id === checkpoint_id);
      if (hit) return hit;
    }
    return null;
  },
  clear(): void {
    memoryStore.clear();
  },
};
