import { describe, it, expect } from 'vitest';

describe('AG-UI Protocol', () => {
  it('exports event types', async () => {
    const { AGUI_EVENT_TYPES } = await import('@/lib/ag-ui/protocol');
    expect(AGUI_EVENT_TYPES.RUN_STARTED).toBe('RUN_STARTED');
    expect(AGUI_EVENT_TYPES.TEXT_MESSAGE_CONTENT).toBe('TEXT_MESSAGE_CONTENT');
    expect(AGUI_EVENT_TYPES.TOOL_CALL_START).toBe('TOOL_CALL_START');
    expect(AGUI_EVENT_TYPES.STATE_DELTA).toBe('STATE_DELTA');
    expect(Object.keys(AGUI_EVENT_TYPES)).toHaveLength(16);
  });

  it('createSSEEmitter produces readable stream', async () => {
    const { createSSEEmitter } = await import('@/lib/ag-ui/protocol');
    const emitter = createSSEEmitter();
    expect(emitter.stream).toBeInstanceOf(ReadableStream);
    expect(typeof emitter.emit).toBe('function');
    expect(typeof emitter.emitText).toBe('function');
    expect(typeof emitter.close).toBe('function');
  });

  it('getSSEHeaders returns correct content-type', async () => {
    const { getSSEHeaders } = await import('@/lib/ag-ui/protocol');
    const headers = getSSEHeaders('https://test.com');
    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['X-Protocol']).toBe('ag-ui/1.0');
  });
});
