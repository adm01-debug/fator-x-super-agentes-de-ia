import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, CheckCircle2, XCircle, Clock, Loader2, Cpu, HardDrive, Download } from 'lucide-react';
import type { SandboxExecution } from '@/components/workflows/SandboxExecutionPanel';

interface SandboxOutputTabProps {
  executions: SandboxExecution[];
}

export function SandboxOutputTab({ executions }: SandboxOutputTabProps) {
  return (
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
                const StatusIcon = isSuccess ? CheckCircle2 : isFailed ? XCircle : exec.status === 'running' ? Loader2 : Clock;
                const statusColor = isSuccess ? 'hsl(var(--nexus-emerald))' : isFailed ? 'hsl(var(--nexus-red))' : 'hsl(var(--nexus-yellow))';

                return (
                  <div key={exec.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
                        <Badge className="bg-muted text-muted-foreground text-[10px]">{exec.language}</Badge>
                        <span className="text-xs text-muted-foreground">{exec.durationMs}ms</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Cpu className="w-3 h-3" /><span>{exec.resourceUsage.cpuPercent.toFixed(1)}%</span>
                        <HardDrive className="w-3 h-3 ml-1" /><span>{exec.resourceUsage.memoryMb.toFixed(0)}MB</span>
                      </div>
                    </div>
                    <pre className="p-2 bg-background rounded text-xs font-mono text-muted-foreground overflow-x-auto max-h-20 overflow-y-auto">{exec.code}</pre>
                    {exec.output && (
                      <div className="p-2 bg-background rounded border-l-2 border-nexus-emerald">
                        <pre className="text-xs font-mono text-nexus-emerald whitespace-pre-wrap">{exec.output}</pre>
                      </div>
                    )}
                    {exec.error && (
                      <div className="p-2 bg-background rounded border-l-2 border-destructive">
                        <pre className="text-xs font-mono text-destructive whitespace-pre-wrap">{exec.error}</pre>
                      </div>
                    )}
                    {exec.artifacts.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {exec.artifacts.map((art, idx) => (
                          <Badge key={idx} className="bg-nexus-orange/20 text-nexus-orange text-[10px] cursor-pointer hover:bg-nexus-orange/30">
                            <Download className="w-3 h-3 mr-1" />{art.name} ({(art.size / 1024).toFixed(1)}KB)
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
  );
}
