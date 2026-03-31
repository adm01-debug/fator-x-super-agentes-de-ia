import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ModelResponse } from '@/stores/oracleStore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModelCardProps {
  response: ModelResponse;
  rank?: number;
  showThinking: boolean;
}

export function ModelCard({ response, rank, showThinking }: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const shortName = response.model.split('/').pop() || response.model;

  // Extract thinking from content if present
  let thinking = response.thinking || '';
  let mainContent = response.content;

  if (!thinking && mainContent.includes('💭')) {
    const parts = mainContent.split(/(?=Resposta:|## Resposta)/);
    if (parts.length > 1) {
      thinking = parts[0];
      mainContent = parts.slice(1).join('');
    }
  }

  return (
    <div className="nexus-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{shortName}</Badge>
          {rank && (
            <Badge variant="default" className="text-[10px] bg-primary/20 text-primary border-primary/30">
              #{rank}
            </Badge>
          )}
        </div>
        <Badge variant={response.success ? 'default' : 'destructive'} className="text-[10px]">
          {response.success ? '✓' : '✗'}
        </Badge>
      </div>

      <p className="text-[10px] text-muted-foreground mb-2 font-medium">{response.persona}</p>

      {/* Thinking toggle */}
      {showThinking && thinking && (
        <div className="mb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            💭 {expanded ? 'Ocultar raciocínio' : 'Ver raciocínio'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-2.5 rounded-md bg-secondary/40 border border-border/30 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {thinking}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Main content */}
      <div className="text-xs text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto">
        {mainContent}
      </div>

      {/* Footer metrics */}
      <div className="flex gap-3 mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
        <span>{response.tokens?.total || 0} tok</span>
        <span>⏱️ {(response.latency_ms / 1000).toFixed(1)}s</span>
        <span>💰 ${(response.cost_usd || 0).toFixed(4)}</span>
      </div>
    </div>
  );
}
