/**
 * HITL Interrupt — `src/lib/hitlInterrupt.ts`
 *
 * Primitivas estilo LangGraph `interrupt()` / `Command(resume=...)`.
 * Não substitui a fila global em `hitlQueue`; complementa com um
 * mecanismo IN-GRAPH que pausa o run corrente e preserva o estado
 * via `checkpointStore`.
 *
 * Fluxo típico num agente custom:
 *   1. Agente atinge condição crítica (desconto > X%).
 *   2. Chama `throwInterrupt({ question, context, resume_tag })`.
 *   3. Runtime captura, grava checkpoint, enfileira em hitlQueue e
 *      para a execução.
 *   4. Humano aprova via `/approvals` → runtime chama `resume(tag, payload)`.
 *   5. Execução retorna exatamente no ponto do `throwInterrupt`, recebendo
 *      `payload` como resultado da "função" que levantou.
 */
import { saveCheckpoint, resumeFrom, type Checkpoint } from '@/services/checkpointStore';
import { enqueueFromAgentTrigger } from '@/services/hitlQueue';

export interface InterruptPayload {
  question: string;
  context?: Record<string, unknown>;
  resume_tag: string; // identifica a retomada (unique por run)
  trigger_key: string; // ex: 'discount_over_15pct'
}

export class GraphInterrupt extends Error {
  readonly payload: InterruptPayload;
  constructor(payload: InterruptPayload) {
    super(`Graph interrupted: ${payload.question}`);
    this.name = 'GraphInterrupt';
    this.payload = payload;
  }
}

export interface InterruptContext {
  thread_id: string;
  agent_id: string;
  step_index: number;
  state: Record<string, unknown>;
  workspace_id?: string;
}

/**
 * Chamado pelo RUNTIME quando captura um `GraphInterrupt`: grava
 * checkpoint + enfileira aprovação + devolve `interrupt_handle` que o
 * cliente usa para checar status e eventualmente retomar.
 */
export async function captureInterrupt(
  interrupt: GraphInterrupt,
  ctx: InterruptContext,
): Promise<{
  checkpoint: Checkpoint | null;
  approval_id: string;
  resume_tag: string;
}> {
  const checkpoint = await saveCheckpoint({
    thread_id: ctx.thread_id,
    agent_id: ctx.agent_id,
    step_index: ctx.step_index,
    state: {
      ...ctx.state,
      __interrupted: true,
      __resume_tag: interrupt.payload.resume_tag,
      __interrupt_question: interrupt.payload.question,
    },
    metadata: { reason: interrupt.payload.question, trigger_key: interrupt.payload.trigger_key },
    workspace_id: ctx.workspace_id,
  });

  const item = await enqueueFromAgentTrigger({
    agent_id: ctx.agent_id,
    trigger_key: interrupt.payload.trigger_key,
    reason: interrupt.payload.question,
    context: {
      ...(interrupt.payload.context ?? {}),
      thread_id: ctx.thread_id,
      checkpoint_id: checkpoint?.checkpoint_id ?? null,
      resume_tag: interrupt.payload.resume_tag,
    },
  });

  return { checkpoint, approval_id: item.id, resume_tag: interrupt.payload.resume_tag };
}

/**
 * Chamado quando a aprovação humana chega — carrega o state do
 * checkpoint e injeta o `resume_payload` no slot `__resume_payload`
 * do state. O runtime detecta isso no próximo turn e devolve o
 * payload como retorno do `throwInterrupt`.
 */
export async function resumeInterrupt(
  checkpoint_id: string,
  resume_payload: unknown,
): Promise<{ state: Record<string, unknown>; next_step: number } | null> {
  const snapshot = await resumeFrom(checkpoint_id);
  if (!snapshot) return null;
  return {
    state: {
      ...snapshot.state,
      __interrupted: false,
      __resume_payload: resume_payload,
    },
    next_step: snapshot.next_step,
  };
}

/**
 * Helper para código de agente: lança `GraphInterrupt` que o runtime
 * captura. Sugar típico:
 *
 *   const approved = await interruptIfAbove(
 *     proposed_discount, 15,
 *     { question: 'Aprovar desconto acima de 15%?', resume_tag: 'discount_approval' }
 *   );
 */
export function throwInterrupt(payload: InterruptPayload): never {
  throw new GraphInterrupt(payload);
}

export async function interruptIfAbove(
  value: number,
  threshold: number,
  p: Omit<InterruptPayload, 'trigger_key'> & { trigger_key?: string },
): Promise<void> {
  if (value > threshold) {
    throwInterrupt({
      ...p,
      trigger_key: p.trigger_key ?? `threshold_${threshold}`,
      context: { ...(p.context ?? {}), value, threshold },
    });
  }
}
