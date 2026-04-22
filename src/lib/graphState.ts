/**
 * Graph State — `src/lib/graphState.ts`
 *
 * Tipado com **reducers** no estilo LangGraph `StateGraph`: cada campo
 * declara como sua atualização faz merge com o valor anterior. Permite
 * fan-in concorrente de múltiplas tools que escrevem no mesmo slot
 * (ex: `messages` com `add_messages`, `costs` com `operator.add`).
 *
 * Uso:
 *   const state = makeStateGraph({
 *     messages: addMessages,
 *     cost_usd: accumNumber,
 *     tool_calls: appendArray,
 *     current_step: replace,
 *   });
 *   state.update({ messages: [{ role: 'user', content: 'oi' }] });
 *   state.update({ cost_usd: 0.02 });
 *   state.current(); // { messages: [...], cost_usd: 0.02, ... }
 */

export type Reducer<T> = (current: T | undefined, incoming: T) => T;

export const replace: Reducer<unknown> = (_curr, inc) => inc;

export const accumNumber: Reducer<number> = (curr = 0, inc) => curr + inc;

export const appendArray = <T>(curr: T[] | undefined, inc: T[] | T): T[] => {
  const base = curr ?? [];
  return Array.isArray(inc) ? [...base, ...inc] : [...base, inc];
};

export const mergeRecord = <V>(
  curr: Record<string, V> | undefined,
  inc: Record<string, V>,
): Record<string, V> => ({ ...(curr ?? {}), ...inc });

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  id?: string;
  tool_call_id?: string;
}

/** `add_messages` reducer padrão LangChain — dedupe por `id` quando presente. */
export const addMessages = (curr: Message[] | undefined, inc: Message[] | Message): Message[] => {
  const base = curr ?? [];
  const next = Array.isArray(inc) ? inc : [inc];
  const byId = new Map<string, number>();
  const out: Message[] = [];
  for (const m of base) {
    if (m.id) byId.set(m.id, out.length);
    out.push(m);
  }
  for (const m of next) {
    if (m.id && byId.has(m.id)) {
      out[byId.get(m.id)!] = m; // replace in place
    } else {
      if (m.id) byId.set(m.id, out.length);
      out.push(m);
    }
  }
  return out;
};

export type ReducersOf<T> = { [K in keyof T]: Reducer<T[K]> };

export interface StateGraph<TState extends Record<string, unknown>> {
  current(): Partial<TState>;
  update(delta: Partial<TState>): void;
  snapshot(): Partial<TState>;
  reset(): void;
}

export function makeStateGraph<TState extends Record<string, unknown>>(
  reducers: ReducersOf<TState>,
  initial: Partial<TState> = {},
): StateGraph<TState> {
  let state: Partial<TState> = { ...initial };

  return {
    current: () => state,
    update(delta) {
      const next: Partial<TState> = { ...state };
      for (const key of Object.keys(delta) as Array<keyof TState>) {
        const reducer = reducers[key];
        const incoming = (delta as Record<string, unknown>)[key as string];
        if (reducer) {
          (next as Record<string, unknown>)[key as string] = reducer(
            (state as Record<string, unknown>)[key as string] as TState[typeof key] | undefined,
            incoming as TState[typeof key],
          );
        } else {
          (next as Record<string, unknown>)[key as string] = incoming;
        }
      }
      state = next;
    },
    snapshot: () => JSON.parse(JSON.stringify(state)) as Partial<TState>,
    reset() {
      state = { ...initial };
    },
  };
}
