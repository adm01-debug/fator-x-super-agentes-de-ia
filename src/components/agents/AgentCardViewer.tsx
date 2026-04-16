/**
 * AgentCardViewer — Shows the A2A Agent Card JSON for an agent.
 * Uses agentCardService to generate the card.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IdCard, Copy, Check, Download } from 'lucide-react';
import { generateAndSaveAgentCard, getAgentCard, type AgentCard } from '@/services/agentCardService';
import { toast } from 'sonner';

interface Props {
  agentId: string;
  agentName: string;
}

export function AgentCardViewer({ agentId, agentName }: Props) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<AgentCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !card) {
      setLoading(true);
      try {
        // Try cached first, then generate
        let generated = await getAgentCard(agentId);
        if (!generated) {
          try { generated = await generateAndSaveAgentCard(agentId); } catch { generated = null; }
        }
        setCard(generated);
      } catch {
        toast.error('Erro ao gerar Agent Card');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopy = async () => {
    if (!card) return;
    await navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setCopied(true);
    toast.success('Agent Card copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!card) return;
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-card-${card.humanReadableId || agentId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <IdCard className="h-3.5 w-3.5" />
          Agent Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5" />
            Agent Card — {agentName}
            <Badge variant="outline" className="text-[10px]">A2A Protocol</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : card ? (
          <>
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copiado!' : 'Copiar JSON'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                <p className="text-xs font-semibold">{card.skills.length}</p>
                <p className="text-[10px] text-muted-foreground">Skills</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                <p className="text-xs font-semibold">{card.capabilities.streaming ? '✅' : '❌'}</p>
                <p className="text-[10px] text-muted-foreground">Streaming</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                <p className="text-xs font-semibold">v{card.capabilities.a2aVersion}</p>
                <p className="text-[10px] text-muted-foreground">A2A Version</p>
              </div>
            </div>

            {/* JSON viewer */}
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-secondary/30 p-4">
              <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-words">
                {JSON.stringify(card, null, 2)}
              </pre>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Erro ao carregar Agent Card
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
