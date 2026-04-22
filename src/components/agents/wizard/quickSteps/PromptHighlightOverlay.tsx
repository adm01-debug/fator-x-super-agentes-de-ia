import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { SectionLocation } from '@/lib/promptSectionLocator';

interface Props {
  prompt: string;
  locations: SectionLocation[];
  /** Ref of the textarea this overlay is mirroring. */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** Tailwind padding-left on the textarea so the overlay aligns. */
  paddingLeftPx: number;
  /** 1-indexed line numbers that contain a contradiction (rendered in red). */
  conflictLines?: number[];
}

/**
 * Mirrored <pre> layer rendered behind the textarea to highlight specific
 * regions: thin-section heading lines (amber background) and ghost
 * placeholders for missing sections (italic amber outline).
 *
 * Sync rules:
 *  - Same font-family / font-size / line-height / padding as the textarea.
 *  - `pointer-events: none` so clicks fall through.
 *  - scrollTop syncs with the textarea on every scroll event.
 */
export function PromptHighlightOverlay({ prompt, locations, textareaRef, paddingLeftPx, conflictLines }: Props) {
  const overlayRef = useRef<HTMLPreElement>(null);

  // Build the overlay content as a sequence of styled segments.
  const segments = useMemo(() => {
    const lines = prompt.split('\n');

    // Build a map: line index → status for thin/ok/missing display.
    const lineStatus = new Map<number, { kind: 'thin' | 'ok'; label: string }>();
    const ghostInserts: { afterChar: number; label: string }[] = [];
    const conflictSet = new Set<number>((conflictLines ?? []).map((n) => n - 1));

    for (const loc of locations) {
      if (loc.status === 'thin') {
        lineStatus.set(loc.headingLine, { kind: 'thin', label: loc.label });
      } else if (loc.status === 'missing') {
        ghostInserts.push({ afterChar: loc.insertChar, label: loc.label });
      }
    }

    // Emit a stream of {text, className} chunks following original line order,
    // injecting ghost placeholders at their `insertChar` positions.
    const out: Array<{ text: string; cls?: string }> = [];

    let charCursor = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = charCursor;
      const lineEnd = charCursor + line.length;

      // Inject any ghost placeholder whose insertChar falls at this line's start.
      const ghostsHere = ghostInserts.filter((g) => g.afterChar === lineStart);
      for (const g of ghostsHere) {
        out.push({
          text: `## ${g.label}  ⊕ inserir aqui\n`,
          cls: 'text-nexus-amber/70 italic',
        });
      }

      const status = lineStatus.get(i);
      const isConflict = conflictSet.has(i);
      if (isConflict) {
        out.push({
          text: line.length > 0 ? line : ' ',
          cls: 'bg-destructive/15 text-destructive/90 border-l-2 border-destructive pl-1 -ml-1',
        });
      } else if (status?.kind === 'thin') {
        out.push({
          text: line,
          cls: 'bg-nexus-amber/15 text-nexus-amber/90 border-l-2 border-nexus-amber pl-1 -ml-1',
        });
      } else {
        // Transparent — just preserve layout.
        out.push({ text: line, cls: 'text-transparent' });
      }
      out.push({ text: '\n', cls: 'text-transparent' });

      charCursor = lineEnd + 1; // +1 for the '\n'
    }

    // Ghosts that should land at the very end of the prompt.
    const tailGhosts = ghostInserts.filter((g) => g.afterChar >= prompt.length);
    for (const g of tailGhosts) {
      out.push({
        text: `## ${g.label}  ⊕ inserir aqui\n`,
        cls: 'text-nexus-amber/70 italic',
      });
    }

    return out;
  }, [prompt, locations, conflictLines]);

  // Sync scroll with the textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;
    const onScroll = () => {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener('scroll', onScroll);
    onScroll();
    return () => ta.removeEventListener('scroll', onScroll);
  }, [textareaRef]);

  // Hide overlay when nothing to show.
  const hasSomething = locations.some((l) => l.status !== 'ok') || (conflictLines?.length ?? 0) > 0;
  if (!hasSomething) return null;

  return (
    <pre
      ref={overlayRef}
      aria-hidden
      className={cn(
        'absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none',
        'font-mono text-xs leading-relaxed',
        'rounded-lg border border-transparent',
      )}
      style={{
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: paddingLeftPx,
        paddingRight: 12,
        zIndex: 1,
      }}
    >
      {segments.map((seg, idx) => (
        <span key={idx} className={seg.cls}>{seg.text}</span>
      ))}
    </pre>
  );
}
