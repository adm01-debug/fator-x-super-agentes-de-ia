import { logger } from '@/lib/logger';
/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Environment Validation
 * ═══════════════════════════════════════════════════════════════
 * Validates all required VITE_* env vars at startup.
 * Fails fast with clear error messages instead of runtime crashes.
 */

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_PROJECT_ID: string;
}

function getEnvVar(key: string, fallback?: string): string {
  const value = import.meta.env[key] as string | undefined;
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

function validateEnv(): EnvConfig {
  try {
    return {
      SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL'),
      SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY'),
      SUPABASE_PROJECT_ID: getEnvVar('VITE_SUPABASE_PROJECT_ID', 'tifbqkyumdxzmxyyoqlu'),
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.error('🔴 Environment validation failed:', (error as Error).message);
      logger.error('   Check your .env file or Lovable environment settings.');
    }
    throw error;
  }
}

/** Validated environment config — use this instead of raw import.meta.env */
export const env = validateEnv();

/** Check if running in development mode */
export const isDev = import.meta.env.DEV;

/** Check if running in production mode */
export const isProd = import.meta.env.PROD;

/** Platform branding — configurable per deployment */
export const platform = {
  organization: getEnvVar('VITE_ORG_NAME', 'Promo Brindes'),
  url: getEnvVar('VITE_ORG_URL', 'https://promobrindes.com.br'),
  supportEmail: getEnvVar('VITE_ORG_SUPPORT_EMAIL', 'suporte@promobrindes.com.br'),
  nexusBaseUrl: typeof window !== 'undefined'
    ? window.location.origin
    : getEnvVar('VITE_NEXUS_BASE_URL', 'https://nexus.promobrindes.com.br'),
} as const;
