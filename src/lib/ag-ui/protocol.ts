/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — AG-UI Protocol Implementation
 * ═══════════════════════════════════════════════════════════════
 * Agent-User Interaction Protocol — the third pillar of the
 * Protocol Triangle (MCP + A2A + AG-UI).
 *
 * Spec: https://docs.ag-ui.com
 * Reference: CopilotKit, Microsoft Agent Framework, AWS AgentCore
 */

// ═══ AG-UI Event Types (16 standard types) ═══

export const AGUI_EVENT_TYPES = {
  // Lifecycle
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',

  // Text streaming
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',

  // Tool calls
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_END: 'TOOL_CALL_END',

  // State management
  STATE_DELTA: 'STATE_DELTA',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',

  // Messages
  MESSAGES_SNAPSHOT: 'MESSAGES_SNAPSHOT',

  // Human-in-the-loop
  STEP_STARTED: 'STEP_STARTED',
  STEP_FINISHED: 'STEP_FINISHED',

  // Custom
  CUSTOM: 'CUSTOM',
  RAW: 'RAW',
} as const;

export type AGUIEventType = typeof AGUI_EVENT_TYPES[keyof typeof AGUI_EVENT_TYPES];

export interface AGUIEvent {
  type: AGUIEventType;
  timestamp: number;
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  data: Record<string, unknown>;
}

// ═══ AG-UI Server-Side Emitter (for Edge Functions) ═══

export function createSSEEmitter() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });

  function emit(event: AGUIEvent) {
    if (!controller) return;
    const data = JSON.stringify(event);
    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
  }

  function emitText(content: string, messageId?: string) {
    emit({ type: 'TEXT_MESSAGE_CONTENT', timestamp: Date.now(), messageId, data: { content } });
  }

  function emitToolStart(toolCallId: string, name: string) {
    emit({ type: 'TOOL_CALL_START', timestamp: Date.now(), toolCallId, data: { name } });
  }

  function emitToolEnd(toolCallId: string, result: unknown) {
    emit({ type: 'TOOL_CALL_END', timestamp: Date.now(), toolCallId, data: { result } });
  }

  function emitStateDelta(delta: Record<string, unknown>) {
    emit({ type: 'STATE_DELTA', timestamp: Date.now(), data: { delta } });
  }

  function emitError(error: string) {
    emit({ type: 'RUN_ERROR', timestamp: Date.now(), data: { error } });
  }

  function close() {
    emit({ type: 'RUN_FINISHED', timestamp: Date.now(), data: {} });
    controller?.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller?.close();
  }

  return {
    stream,
    emit,
    emitText,
    emitToolStart,
    emitToolEnd,
    emitStateDelta,
    emitError,
    close,
  };
}

// ═══ AG-UI Response Headers ═══

export function getSSEHeaders(origin?: string): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'X-Protocol': 'ag-ui/1.0',
  };
}
