/**
 * DrilldownAuditPanel — Slide-in Sheet showing the timeline of toggle/filter
 * changes captured by useDrilldownAuditLog. Lets the user copy the URL of
 * any past state to reproduce a shared view.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Copy, ExternalLink, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { DrilldownAuditEntry } from '@/lib/slo/useDrilldownAuditLog';

interface DrilldownAuditPanelProps {
  entries: DrilldownAuditEntry[];
  onClear: () => void;
}

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 5) return 'agora';
  if (sec < 60) return `${sec}s atrás`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}min atrás`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function DrilldownAuditPanel({ entries, onClear }: DrilldownAuditPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (entry: DrilldownAuditEntry) => {
    try {
      await navigator.clipboard.writeText(entry.url);
      setCopiedId(entry.id);
      toast.success('URL do estado copiada');
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Não foi possível copiar a URL');
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 relative"
          title="Ver histórico de filtros e toggles desta sessão"
        >
          <History className="h-3.5 w-3.5" />
          Histórico
          {entries.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 px-1 text-[10px] font-mono tabular-nums"
            >
              {entries.length > 99 ? '99+' : entries.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Auditoria do drill-down
          </SheetTitle>
          <SheetDescription>
            Mudanças de filtros e toggles registradas nesta aba. Some ao fechar a sessão.
            Clique em <span className="font-medium text-foreground">Copiar URL</span> para
            reproduzir o mesmo estado em um link compartilhado.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-secondary/20">
          <p className="text-xs text-muted-foreground">
            {entries.length === 0
              ? 'Nenhum evento ainda'
              : `${entries.length} evento${entries.length === 1 ? '' : 's'} nesta sessão`}
          </p>
          {entries.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                onClear();
                toast.success('Histórico limpo');
              }}
            >
              <Trash2 className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <History className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Nada para mostrar ainda
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Ajuste a janela, baseline, filtros ou toggles do drill-down para
                começar a registrar eventos aqui.
              </p>
            </div>
          ) : (
            <ol className="px-6 py-4 space-y-3">
              {entries.map((entry, idx) => (
                <li
                  key={entry.id}
                  className="relative pl-5 group"
                >
                  {/* Timeline dot + line */}
                  <span
                    className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"
                    aria-hidden
                  />
                  {idx < entries.length - 1 && (
                    <span
                      className="absolute left-[3px] top-4 bottom-[-12px] w-px bg-border/60"
                      aria-hidden
                    />
                  )}

                  <div className="space-y-2 rounded-md border border-border/40 bg-card p-3 hover:border-primary/30 transition-colors">
                    <div className="flex items-baseline justify-between gap-2">
                      <time
                        className="text-[11px] font-medium text-muted-foreground tabular-nums"
                        dateTime={entry.ts}
                        title={new Date(entry.ts).toLocaleString('pt-BR')}
                      >
                        {formatRelative(entry.ts)}
                      </time>
                      <span className="text-[10px] text-muted-foreground/70 font-mono">
                        {new Date(entry.ts).toLocaleTimeString('pt-BR', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </span>
                    </div>

                    <ul className="space-y-1">
                      {entry.changes.map((c) => (
                        <li key={c.field} className="text-xs leading-relaxed">
                          <span className="font-semibold text-foreground">{c.label}: </span>
                          <span className="text-muted-foreground line-through decoration-destructive/40">
                            {c.from}
                          </span>
                          <span className="mx-1.5 text-muted-foreground/50" aria-hidden>→</span>
                          <span className="text-primary font-medium">{c.to}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopy(entry)}
                      >
                        {copiedId === entry.id ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copiar URL
                          </>
                        )}
                      </Button>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-secondary/40 transition-colors"
                        title="Abrir este estado em uma nova aba"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
