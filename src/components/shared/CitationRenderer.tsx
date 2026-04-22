import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, BookOpen } from 'lucide-react';

interface Citation {
  index: number;
  chunk_id?: string;
  document_title?: string;
  source_url?: string;
  content_preview: string;
  relevance_score?: number;
}

interface CitationRendererProps {
  text: string;
  citations: Citation[];
}

/**
 * Renders text with inline citation markers [1], [2] etc.
 * Citations appear as clickable badges that expand to show source details.
 *
 * Usage: Gateway returns citations array in response metadata when RAG is used.
 * Text should contain [1], [2] markers referencing citation indices.
 */
export function CitationRenderer({ text, citations }: CitationRendererProps) {
  const [expandedCitation, setExpandedCitation] = useState<number | null>(null);

  if (!citations || citations.length === 0) return <span>{text}</span>;

  // Parse text and replace [N] with clickable citation badges
  const parts = text.split(/(\[\d+\])/g);

  return (
    <div className="space-y-2">
      <div className="text-sm text-foreground leading-relaxed">
        {parts.map((part, i) => {
          const match = part.match(/^\[(\d+)\]$/);
          if (match) {
            const idx = parseInt(match[1]);
            const citation = citations.find((c) => c.index === idx);
            if (!citation)
              return (
                <sup key={i} className="text-muted-foreground text-[11px]">
                  [{idx}]
                </sup>
              );
            return (
              <sup key={i} className="inline-flex items-center">
                <button
                  type="button"
                  className="inline-flex items-center cursor-pointer bg-transparent border-0 p-0"
                  onClick={() => setExpandedCitation(expandedCitation === idx ? null : idx)}
                >
                  <Badge
                    variant="outline"
                    className="text-[11px] h-4 px-1 ml-0.5 hover:bg-primary/10 transition-colors"
                  >
                    {idx}
                  </Badge>
                </button>
              </sup>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      {/* Citation details panel */}
      {expandedCitation !== null && (
        <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs space-y-1.5">
          {(() => {
            const c = citations.find((ci) => ci.index === expandedCitation);
            if (!c) return null;
            return (
              <>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium text-foreground">
                    [{c.index}] {c.document_title || 'Documento'}
                  </span>
                  {c.relevance_score != null && (
                    <Badge variant="outline" className="text-[8px] ml-auto">
                      {(c.relevance_score * 100).toFixed(0)}% relevante
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground italic">{c.content_preview}</p>
                {c.source_url && (
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-[11px]"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver fonte
                  </a>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Citation list footer */}
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/30">
          <span className="text-[11px] text-muted-foreground mr-1">Fontes:</span>
          {citations.map((c) => (
            <Badge
              key={c.index}
              variant="outline"
              className="text-[11px] cursor-pointer hover:bg-primary/10"
              onClick={() => setExpandedCitation(expandedCitation === c.index ? null : c.index)}
            >
              [{c.index}] {c.document_title?.substring(0, 20) || 'Doc'}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
