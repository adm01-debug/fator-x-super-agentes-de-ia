export type SandboxRuntime = 'docker' | 'wasm' | 'local' | 'none';

export interface SandboxConfig {
  runtime: SandboxRuntime;
  image?: string;
  cpuLimit: number;
  memoryLimitMb: number;
  timeoutSeconds: number;
  networkEnabled: boolean;
  allowedDomains: string[];
  allowedLanguages: string[];
  maxFileSizeMb: number;
  maxWorkspaceSizeMb: number;
  writeAccess: boolean;
  shellAccess: boolean;
  envVars: Record<string, string>;
}

export interface SandboxExecution {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
  code: string;
  language: string;
  output: string;
  error: string | null;
  exitCode: number | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  resourceUsage: {
    cpuPercent: number;
    memoryMb: number;
    networkBytes: number;
  };
  artifacts: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
}

export interface SandboxExecutionPanelProps {
  agentId?: string;
  onConfigChange?: (config: SandboxConfig) => void;
  onExecute?: (code: string, language: string) => Promise<SandboxExecution>;
}

export const DEFAULT_CONFIG: SandboxConfig = {
  runtime: 'docker',
  image: 'nexus-sandbox:latest',
  cpuLimit: 1,
  memoryLimitMb: 512,
  timeoutSeconds: 30,
  networkEnabled: false,
  allowedDomains: [],
  allowedLanguages: ['python', 'javascript', 'typescript', 'bash'],
  maxFileSizeMb: 10,
  maxWorkspaceSizeMb: 100,
  writeAccess: true,
  shellAccess: false,
  envVars: {},
};

export const RUNTIME_OPTIONS: Array<{
  id: SandboxRuntime;
  name: string;
  description: string;
  securityLevel: 'high' | 'medium' | 'low' | 'none';
}> = [
  { id: 'docker', name: 'Docker Container', description: 'Execução isolada em container Docker com filesystem e rede próprios', securityLevel: 'high' },
  { id: 'wasm', name: 'WebAssembly (WASM)', description: 'Execução no browser via Pyodide/QuickJS, sem acesso ao sistema', securityLevel: 'high' },
  { id: 'local', name: 'Local (Desenvolvimento)', description: 'Execução local sem isolamento — APENAS para desenvolvimento', securityLevel: 'low' },
  { id: 'none', name: 'Desabilitado', description: 'Execução de código desabilitada para este agente', securityLevel: 'none' },
];

export const SECURITY_LEVEL_COLORS: Record<string, string> = {
  high: 'hsl(var(--nexus-emerald))',
  medium: 'hsl(var(--nexus-yellow))',
  low: 'hsl(var(--nexus-red))',
  none: 'hsl(var(--muted-foreground))',
};
