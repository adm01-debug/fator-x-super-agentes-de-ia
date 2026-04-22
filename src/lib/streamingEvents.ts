/**
 * Streaming Events — `src/lib/streamingEvents.ts`
 *
 * Tipos e parser inspirados em OpenAI Responses API / LangGraph
 * `astream_events`. Eventos granulares durante a execução do agente:
 *
 *   run.start → token delta → tool_call.delta → tool_call.end
 *              → tool_result → message.end → run.end
 *
 * O edge function do gateway emite esses eventos via Server-Sent
 * Events (SSE); este módulo fornece tipos + parser + reducer para
 * reconstruir o `messages` state a partir do stream.
 */

export type StreamEvent =
  | { type: 'run.start'; run_id: string; agent_id: string }
  | { type: 'message.delta'; content: string; role?: 'assistant' }
  | { type: 'message.end'; content: string; message_id: string }
  | { type: 'reasoning.delta'; content: string }
  | { type: 'reasoning.end'; content: string }
  | { type: 'tool_call.start'; tool_call_id: string; name: string }
  | { type: 'tool_call.delta'; tool_call_id: string; args_delta: string }
  | { type: 'tool_call.end'; tool_call_id: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool_call_id: string; result: unknown; error?: string }
  | { type: 'run.end'; run_id: string; tokens: { in: number; out: number }; cost_usd: number }
  | { type: 'run.error'; run_id: string; error: string };

export interface StreamSnapshot {
  run_id: string | null;
  agent_id: string | null;
  message: string;
  reasoning: string;
  tool_calls: Record<
    string,
    {
      name: string;
      args_raw: string;
      args_parsed?: Record<string, unknown>;
      result?: unknown;
      error?: string;
    }
  >;
  tokens: { in: number; out: number };
  cost_usd: number;
  finished: boolean;
  error: string | null;
}

export function emptySnapshot(): StreamSnapshot {
  return {
    run_id: null,
    agent_id: null,
    message: '',
    reasoning: '',
    tool_calls: {},
    tokens: { in: 0, out: 0 },
    cost_usd: 0,
    finished: false,
    error: null,
  };
}

/** Aplica um evento do stream ao snapshot — reducer puro, sem I/O. */
export function applyEvent(snapshot: StreamSnapshot, event: StreamEvent): StreamSnapshot {
  switch (event.type) {
    case 'run.start':
      return { ...snapshot, run_id: event.run_id, agent_id: event.agent_id };
    case 'message.delta':
      return { ...snapshot, message: snapshot.message + event.content };
    case 'message.end':
      return { ...snapshot, message: event.content };
    case 'reasoning.delta':
      return { ...snapshot, reasoning: snapshot.reasoning + event.content };
    case 'reasoning.end':
      return { ...snapshot, reasoning: event.content };
    case 'tool_call.start':
      return {
        ...snapshot,
        tool_calls: {
          ...snapshot.tool_calls,
          [event.tool_call_id]: { name: event.name, args_raw: '' },
        },
      };
    case 'tool_call.delta': {
      const curr = snapshot.tool_calls[event.tool_call_id] ?? { name: '', args_raw: '' };
      return {
        ...snapshot,
        tool_calls: {
          ...snapshot.tool_calls,
          [event.tool_call_id]: { ...curr, args_raw: curr.args_raw + event.args_delta },
        },
      };
    }
    case 'tool_call.end': {
      const curr = snapshot.tool_calls[event.tool_call_id] ?? { name: '', args_raw: '' };
      return {
        ...snapshot,
        tool_calls: {
          ...snapshot.tool_calls,
          [event.tool_call_id]: { ...curr, args_parsed: event.args },
        },
      };
    }
    case 'tool_result': {
      const curr = snapshot.tool_calls[event.tool_call_id] ?? { name: '', args_raw: '' };
      return {
        ...snapshot,
        tool_calls: {
          ...snapshot.tool_calls,
          [event.tool_call_id]: { ...curr, result: event.result, error: event.error },
        },
      };
    }
    case 'run.end':
      return {
        ...snapshot,
        tokens: event.tokens,
        cost_usd: event.cost_usd,
        finished: true,
      };
    case 'run.error':
      return { ...snapshot, error: event.error, finished: true };
  }
}

/** Parse uma linha SSE `event: type\ndata: {...}` em `StreamEvent`. */
export function parseSseLine(line: string): StreamEvent | null {
  const match = /^data:\s*(.+)$/m.exec(line);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as StreamEvent;
  } catch {
    return null;
  }
}

/** Alimenta o snapshot com uma string SSE (possivelmente multi-line). */
export function feedSse(snapshot: StreamSnapshot, chunk: string): StreamSnapshot {
  let next = snapshot;
  for (const line of chunk.split('\n\n')) {
    const event = parseSseLine(line);
    if (event) next = applyEvent(next, event);
  }
  return next;
}
