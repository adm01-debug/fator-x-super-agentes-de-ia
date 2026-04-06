/**
 * Nexus Agents Studio — Shared Edge Function Logger
 * Structured logging for Deno Edge Functions.
 * Replaces raw console.log/error/warn with structured JSON output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  fn: string;
  msg: string;
  data?: Record<string, unknown>;
  ts: string;
}

function log(level: LogLevel, fn: string, msg: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    fn,
    msg,
    ...(data ? { data } : {}),
    ts: new Date().toISOString(),
  };
  const formatted = JSON.stringify(entry);
  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export function createLogger(functionName: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', functionName, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log('info', functionName, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', functionName, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('error', functionName, msg, data),
  };
}
