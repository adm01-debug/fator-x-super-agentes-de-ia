import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Square, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import type { SandboxConfig } from '@/components/workflows/SandboxExecutionPanel';

interface SandboxExecuteTabProps {
  config: SandboxConfig;
  codeInput: string;
  setCodeInput: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  isRunning: boolean;
  onExecute: () => void;
  onStop: () => void;
}

export function SandboxExecuteTab({
  config,
  codeInput,
  setCodeInput,
  language,
  setLanguage,
  isRunning,
  onExecute,
  onStop,
}: SandboxExecuteTabProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Linguagem:</span>
          <div className="flex gap-1">
            {config.allowedLanguages.map((lang) => (
              <Badge
                key={lang}
                className={`cursor-pointer text-[10px] ${language === lang ? 'bg-primary text-foreground' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
                onClick={() => setLanguage(lang)}
              >
                {lang}
              </Badge>
            ))}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="w-full h-40 p-3 bg-background border border-border rounded-lg text-sm font-mono text-muted-foreground resize-none focus:border-primary focus:outline-none"
            placeholder={`# Escreva seu código ${language} aqui...`}
            spellCheck={false}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onExecute}
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
              onClick={onStop}
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
  );
}
