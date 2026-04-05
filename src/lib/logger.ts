/**
 * Structured logger for consistent logging across the application.
 * In production, outputs JSON for ingestion by observability platforms.
 * In development, outputs human-readable console format.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
  userId?: string;
  error?: { message: string; stack?: string };
  traceId?: string;
}

const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

// --- PII Masking ---

/** Matches common email patterns */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Matches Brazilian CPF patterns: 000.000.000-00 or 00000000000 */
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

function maskPII(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[REDACTED]')
    .replace(CPF_PATTERN, '[REDACTED]');
}

// --- Trace ID ---

let _currentTraceId: string | undefined;

/** Generate a UUID v4-style trace ID */
function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Set the current trace ID for the request context */
export function setTraceId(traceId?: string): string {
  _currentTraceId = traceId ?? generateTraceId();
  return _currentTraceId;
}

/** Get the current trace ID */
export function getTraceId(): string | undefined {
  return _currentTraceId;
}

/** Clear the current trace ID */
export function clearTraceId(): void {
  _currentTraceId = undefined;
}

// --- Log Entry Creation ---

function createEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
): LogEntry {
  return {
    level,
    message: maskPII(message),
    timestamp: new Date().toISOString(),
    context,
    data,
    traceId: _currentTraceId,
  };
}

// --- Output ---

function outputJSON(entry: LogEntry) {
  const jsonLine = JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    context: entry.context,
    data: entry.data,
    traceId: entry.traceId,
    ...(entry.error ? { error: entry.error } : {}),
  });

  // Use console methods so browser/Node.js transports still apply
  switch (entry.level) {
    case 'error':
      console.error(jsonLine);
      break;
    case 'warn':
      console.warn(jsonLine);
      break;
    default:
      console.log(jsonLine);
      break;
  }
}

function outputConsole(entry: LogEntry) {
  const prefix = `[${entry.level.toUpperCase()}] ${entry.context ? `[${entry.context}]` : ''}`;

  switch (entry.level) {
    case 'error':
      console.error(prefix, entry.message, entry.data || '', entry.error || '');
      break;
    case 'warn':
      console.warn(prefix, entry.message, entry.data || '');
      break;
    case 'info':
      console.info(prefix, entry.message, entry.data || '');
      break;
    case 'debug':
      console.debug(prefix, entry.message, entry.data || '');
      break;
  }
}

function output(entry: LogEntry) {
  // Suppress debug logs in production
  if (!IS_DEV && entry.level === 'debug') return;

  if (IS_PROD) {
    outputJSON(entry);
  } else {
    outputConsole(entry);
  }
}

// --- Public API ---

export const logger = {
  debug: (message: string, context?: string, data?: Record<string, unknown>) =>
    output(createEntry('debug', message, context, data)),

  info: (message: string, context?: string, data?: Record<string, unknown>) =>
    output(createEntry('info', message, context, data)),

  warn: (message: string, context?: string, data?: Record<string, unknown>) =>
    output(createEntry('warn', message, context, data)),

  error: (message: string, error?: unknown, context?: string) => {
    const entry = createEntry('error', message, context);
    if (error instanceof Error) {
      entry.error = { message: maskPII(error.message), stack: error.stack };
    }
    output(entry);
  },
};
