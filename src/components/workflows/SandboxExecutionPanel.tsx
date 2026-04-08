/**
 * Nexus Agents Studio — Sandboxed Execution Panel
 * 
 * UI component for configuring and monitoring sandboxed code execution.
 * Inspired by DeerFlow 2.0's Docker sandbox and Smolagents' sandboxed execution.
 * 
 * Features:
 * - Configure sandbox environment (Docker/WASM/Local)
 * - Set resource limits (CPU, memory, timeout, network)
 * - View execution logs in real-time
 * - File system browser for sandbox workspace
 * - Security policy editor
 * - Execution history with artifacts
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Terminal,
  Settings,
  Play,
  Square,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Lock,
  Loader2,
  RotateCcw,
  Download,
} from 'lucide-react';

// ──────── Types ────────

export type SandboxRuntime = 'docker' | 'wasm' | 'local' | 'none';

export interface SandboxConfig {
  runtime: SandboxRuntime;
  /** Docker image to use (for docker runtime) */
  image?: string;
  /** Max CPU cores */
  cpuLimit: number;
  /** Max memory in MB */
  memoryLimitMb: number;
  /** Max execution time in seconds */
  timeoutSeconds: number;
  /** Allow network access */
  networkEnabled: boolean;
  /** Allowed domains (if network enabled) */
  allowedDomains: string[];
  /** Allowed languages for code execution */
  allowedLanguages: string[];
  /** Max file size in MB for workspace */
  maxFileSizeMb: number;
  /** Max total workspace size in MB */
  maxWorkspaceSizeMb: number;
  /** Enable filesystem write access */
  writeAccess: boolean;
  /** Enable shell access */
  shellAccess: boolean;
  /** Custom environment variables */
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

interface SandboxExecutionPanelProps {
  agentId?: string;
  onConfigChange?: (config: SandboxConfig) => void;
  onExecute?: (code: string, language: string) => Promise<SandboxExecution>;
}

// ──────── Default Config ────────

const DEFAULT_CONFIG: SandboxConfig = {
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

const RUNTIME_OPTIONS: Array<{
  id: SandboxRuntime;
  name: string;
  description: string;
  securityLevel: 'high' | 'medium' | 'low' | 'none';
}> = [
  {
    id: 'docker',
    name: 'Docker Container',
    description: 'Execução isolada em container Docker com filesystem e rede próprios',
    securityLevel: 'high',
  },
  {
    id: 'wasm',
    name: 'WebAssembly (WASM)',
    description: 'Execução no browser via Pyodide/QuickJS, sem acesso ao sistema',
    securityLevel: 'high',
  },
  {
    id: 'local',
    name: 'Local (Desenvolvimento)',
    description: 'Execução local sem isolamento — APENAS para desenvolvimento',
    securityLevel: 'low',
  },
  {
    id: 'none',
    name: 'Desabilitado',
    description: 'Execução de código desabilitada para este agente',
    securityLevel: 'none',
  },
];

const SECURITY_LEVEL_COLORS: Record<string, string> = {
  high: '#6BCB77',
  medium: '#FFD93D',
  low: '#FF6B6B',
  none: '#666',
};

// ──────── Helper Components ────────

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-medium text-foreground">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: typeof Shield;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        <div>
          <p className="text-sm text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div
        className={`w-10 h-5 rounded-full flex items-center transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </div>
  );
}

// ──────── Main Component ────────

export function SandboxExecutionPanel({
  agentId,
  onConfigChange,
  onExecute,
}: SandboxExecutionPanelProps) {
  const [config, setConfig] = useState<SandboxConfig>({ ...DEFAULT_CONFIG });
  const [executions, setExecutions] = useState<SandboxExecution[]>([]);
  const [codeInput, setCodeInput] = useState('print("Hello from Nexus Sandbox!")');
  const [language, setLanguage] = useState('python');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('config');

  const updateConfig = useCallback(
    (updates: Partial<SandboxConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      onConfigChange?.(newConfig);
    },
    [config, onConfigChange]
  );

  const handleExecute = useCallback(async () => {
    if (!onExecute || isRunning) return;
    setIsRunning(true);

    try {
      const result = await onExecute(codeInput, language);
      setExecutions((prev) => [result, ...prev]);
      setActiveTab('output');
    } catch (err) {
      const failedExecution: SandboxExecution = {
        id: crypto.randomUUID(),
        status: 'failed',
        code: codeInput,
        language,
        output: '',
        error: err instanceof Error ? err.message : 'Execution failed',
        exitCode: 1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        resourceUsage: { cpuPercent: 0, memoryMb: 0, networkBytes: 0 },
        artifacts: [],
      };
      setExecutions((prev) => [failedExecution, ...prev]);
    } finally {
      setIsRunning(false);
    }
  }, [codeInput, language, onExecute, isRunning]);

  const selectedRuntime = RUNTIME_OPTIONS.find((r) => r.id === config.runtime);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base text-foreground">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-nexus-emerald" />
              Sandboxed Execution
              {agentId && (
                <Badge className="bg-primary/20 text-primary text-[10px] ml-1">
                  Agent Config
                </Badge>
              )}
            </span>
            <Badge
              className="text-[10px]"
              style={{
                backgroundColor: `${SECURITY_LEVEL_COLORS[selectedRuntime?.securityLevel ?? 'none']}20`,
                color: SECURITY_LEVEL_COLORS[selectedRuntime?.securityLevel ?? 'none'],
              }}
            >
              {selectedRuntime?.securityLevel === 'high'
                ? '🔒 Alta Segurança'
                : selectedRuntime?.securityLevel === 'medium'
                  ? '⚠️ Segurança Média'
                  : selectedRuntime?.securityLevel === 'low'
                    ? '🔓 Baixa Segurança'
                    : '⛔ Desabilitado'}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-background border border-border">
          <TabsTrigger value="config" className="data-[state=active]:bg-muted">
            <Settings className="w-3 h-3 mr-1" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="execute" className="data-[state=active]:bg-muted">
            <Terminal className="w-3 h-3 mr-1" />
            Executar
          </TabsTrigger>
          <TabsTrigger value="output" className="data-[state=active]:bg-muted">
            <FileText className="w-3 h-3 mr-1" />
            Saída
            {executions.length > 0 && (
              <Badge className="ml-1 bg-primary/20 text-primary text-[9px]">
                {executions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-muted">
            <Lock className="w-3 h-3 mr-1" />
            Políticas
          </TabsTrigger>
        </TabsList>

        {/* ──── Config Tab ──── */}
        <TabsContent value="config">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-4">
              {/* Runtime Selection */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Runtime</label>
                <div className="grid grid-cols-2 gap-2">
                  {RUNTIME_OPTIONS.map((rt) => (
                    <div
                      key={rt.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        config.runtime === rt.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:border-border'
                      }`}
                      onClick={() => updateConfig({ runtime: rt.id })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{rt.name}</span>
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: SECURITY_LEVEL_COLORS[rt.securityLevel] }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{rt.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resource Limits */}
              {config.runtime !== 'none' && (
                <div className="space-y-3">
                  <label className="text-xs text-muted-foreground font-medium">Limites de Recursos</label>
                  <SliderField
                    label="CPU"
                    value={config.cpuLimit}
                    min={0.25}
                    max={4}
                    step={0.25}
                    unit="cores"
                    onChange={(v) => updateConfig({ cpuLimit: v })}
                  />
                  <SliderField
                    label="Memória"
                    value={config.memoryLimitMb}
                    min={128}
                    max={4096}
                    step={128}
                    unit="MB"
                    onChange={(v) => updateConfig({ memoryLimitMb: v })}
                  />
                  <SliderField
                    label="Timeout"
                    value={config.timeoutSeconds}
                    min={5}
                    max={300}
                    step={5}
                    unit="seg"
                    onChange={(v) => updateConfig({ timeoutSeconds: v })}
                  />
                  <SliderField
                    label="Workspace Máximo"
                    value={config.maxWorkspaceSizeMb}
                    min={10}
                    max={1000}
                    step={10}
                    unit="MB"
                    onChange={(v) => updateConfig({ maxWorkspaceSizeMb: v })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──── Execute Tab ──── */}
        <TabsContent value="execute">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-3">
              {/* Language selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Linguagem:</label>
                <div className="flex gap-1">
                  {config.allowedLanguages.map((lang) => (
                    <Badge
                      key={lang}
                      className={`cursor-pointer text-[10px] ${
                        language === lang
                          ? 'bg-primary text-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => setLanguage(lang)}
                    >
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Code input */}
              <div className="relative">
                <textarea
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  className="w-full h-40 p-3 bg-background border border-border rounded-lg text-sm font-mono text-muted-foreground resize-none focus:border-primary focus:outline-none"
                  placeholder={`# Escreva seu código ${language} aqui...`}
                  spellCheck={false}
                />
              </div>

              {/* Execute button */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExecute}
                  disabled={isRunning || config.runtime === 'none' || !codeInput.trim()}
                  className="bg-nexus-emerald hover:bg-nexus-emerald/80 text-foreground"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Executar
                    </>
                  )}
                </Button>
                {isRunning && (
                  <Button
                    variant="outline"
                    onClick={() => setIsRunning(false)}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Parar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => setCodeInput('')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              </div>

              {config.runtime === 'none' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-nexus-amber/10 border border-nexus-amber/30">
                  <AlertTriangle className="w-4 h-4 text-nexus-amber" />
                  <span className="text-xs text-nexus-amber">
                    Execução de código está desabilitada. Selecione um runtime na aba Configuração.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──── Output Tab ──── */}
        <TabsContent value="output">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {executions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Terminal className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma execução ainda</p>
                    <p className="text-xs">Execute código na aba anterior</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#222244]">
                    {executions.map((exec) => {
                      const isSuccess = exec.status === 'completed' && exec.exitCode === 0;
                      const isFailed = exec.status === 'failed' || exec.status === 'timeout';
                      const StatusIcon = isSuccess
                        ? CheckCircle2
                        : isFailed
                          ? XCircle
                          : exec.status === 'running'
                            ? Loader2
                            : Clock;
                      const statusColor = isSuccess
                        ? '#6BCB77'
                        : isFailed
                          ? '#FF6B6B'
                          : '#FFD93D';

                      return (
                        <div key={exec.id} className="p-4 space-y-2">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <StatusIcon
                                className="w-4 h-4"
                                style={{ color: statusColor }}
                              />
                              <Badge className="bg-muted text-muted-foreground text-[10px]">
                                {exec.language}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {exec.durationMs}ms
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Cpu className="w-3 h-3" />
                              <span>{exec.resourceUsage.cpuPercent.toFixed(1)}%</span>
                              <HardDrive className="w-3 h-3 ml-1" />
                              <span>{exec.resourceUsage.memoryMb.toFixed(0)}MB</span>
                            </div>
                          </div>

                          {/* Code */}
                          <pre className="p-2 bg-background rounded text-xs font-mono text-muted-foreground overflow-x-auto max-h-20 overflow-y-auto">
                            {exec.code}
                          </pre>

                          {/* Output */}
                          {exec.output && (
                            <div className="p-2 bg-background rounded border-l-2 border-nexus-emerald">
                              <pre className="text-xs font-mono text-nexus-emerald whitespace-pre-wrap">
                                {exec.output}
                              </pre>
                            </div>
                          )}

                          {/* Error */}
                          {exec.error && (
                            <div className="p-2 bg-background rounded border-l-2 border-destructive">
                              <pre className="text-xs font-mono text-destructive whitespace-pre-wrap">
                                {exec.error}
                              </pre>
                            </div>
                          )}

                          {/* Artifacts */}
                          {exec.artifacts.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {exec.artifacts.map((art, idx) => (
                                <Badge
                                  key={idx}
                                  className="bg-orange-500/20 text-orange-500 text-[10px] cursor-pointer hover:bg-orange-500/30"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  {art.name} ({(art.size / 1024).toFixed(1)}KB)
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──── Security Policies Tab ──── */}
        <TabsContent value="security">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-3">
              <ToggleField
                label="Acesso à Rede"
                description="Permitir que o código acesse a internet"
                checked={config.networkEnabled}
                onChange={(v) => updateConfig({ networkEnabled: v })}
                icon={config.networkEnabled ? Wifi : WifiOff}
              />

              <ToggleField
                label="Escrita em Disco"
                description="Permitir que o código crie/edite arquivos no workspace"
                checked={config.writeAccess}
                onChange={(v) => updateConfig({ writeAccess: v })}
                icon={HardDrive}
              />

              <ToggleField
                label="Acesso ao Shell"
                description="Permitir execução de comandos shell (bash/sh)"
                checked={config.shellAccess}
                onChange={(v) => updateConfig({ shellAccess: v })}
                icon={Terminal}
              />

              {/* Allowed Domains */}
              {config.networkEnabled && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Domínios Permitidos</label>
                  <textarea
                    value={config.allowedDomains.join('\n')}
                    onChange={(e) =>
                      updateConfig({
                        allowedDomains: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    className="w-full h-20 p-2 bg-background border border-border rounded text-xs font-mono text-muted-foreground resize-none focus:border-primary focus:outline-none"
                    placeholder="api.exemplo.com&#10;github.com&#10;pypi.org"
                  />
                </div>
              )}

              {/* Security Summary */}
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="text-xs font-medium text-foreground mb-2">Resumo de Segurança</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Runtime</span>
                    <span className="text-foreground">{selectedRuntime?.name ?? 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Isolamento</span>
                    <Badge
                      className="text-[9px]"
                      style={{
                        backgroundColor: `${SECURITY_LEVEL_COLORS[selectedRuntime?.securityLevel ?? 'none']}20`,
                        color: SECURITY_LEVEL_COLORS[selectedRuntime?.securityLevel ?? 'none'],
                      }}
                    >
                      {selectedRuntime?.securityLevel ?? 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rede</span>
                    <span className={config.networkEnabled ? 'text-nexus-amber' : 'text-nexus-emerald'}>
                      {config.networkEnabled ? `Habilitada (${config.allowedDomains.length} domínios)` : 'Bloqueada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Shell</span>
                    <span className={config.shellAccess ? 'text-destructive' : 'text-nexus-emerald'}>
                      {config.shellAccess ? 'Habilitado ⚠️' : 'Bloqueado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Linguagens</span>
                    <span className="text-foreground">{config.allowedLanguages.join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* Warning for low security */}
              {(config.shellAccess || config.runtime === 'local') && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-destructive">Atenção: Configuração de Risco</p>
                    <p className="text-xs text-destructive/80 mt-1">
                      {config.runtime === 'local'
                        ? 'Runtime local não tem isolamento. Use apenas em ambiente de desenvolvimento.'
                        : 'Acesso ao shell permite execução arbitrária de comandos. Use com cautela.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
