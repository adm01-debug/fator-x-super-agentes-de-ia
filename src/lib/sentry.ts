/**
 * ═══════════════════════════════════════════════════════════════
 * Sentry Initialization — Production Error Observability
 * ═══════════════════════════════════════════════════════════════
 * No-op silently when VITE_SENTRY_DSN is not configured.
 * PII scrubbing applied via beforeSend hook.
 */
import * as Sentry from '@sentry/react';

declare const __APP_VERSION__: string;

let initialized = false;

const IGNORED_ERRORS = [
  /ResizeObserver loop/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /Network request failed/i,
  /Failed to fetch/i,
  /Load failed/i,
  /Non-Error promise rejection captured/i,
];

const PII_KEYS = /(email|password|token|authorization|api[_-]?key|secret|cookie|session)/i;

function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = PII_KEYS.test(k) ? '[REDACTED]' : scrubObject(v, depth + 1);
  }
  return out;
}

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // no-op when not configured

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      beforeSend(event) {
        const msg = event.message || event.exception?.values?.[0]?.value || '';
        if (IGNORED_ERRORS.some((re) => re.test(msg))) return null;
        if (event.request) event.request = scrubObject(event.request) as typeof event.request;
        if (event.extra) event.extra = scrubObject(event.extra) as typeof event.extra;
        if (event.user?.email) event.user.email = '[REDACTED]';
        return event;
      },
      ignoreErrors: IGNORED_ERRORS,
    });
    initialized = true;
  } catch {
    // never break the app due to telemetry
  }
}

export function isSentryEnabled(): boolean {
  return initialized;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context ? { extra: scrubObject(context) as Record<string, unknown> } : undefined);
  } catch {
    /* noop */
  }
}

export { Sentry };
