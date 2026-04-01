/**
 * Structured logger for consistent logging across the application.
 * In production, these would be sent to an observability platform.
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
}

const IS_DEV = import.meta.env.DEV;

function createEntry(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };
}

function output(entry: LogEntry) {
  if (!IS_DEV && entry.level === 'debug') return;

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
      entry.error = { message: error.message, stack: error.stack };
    }
    output(entry);
  },
};
