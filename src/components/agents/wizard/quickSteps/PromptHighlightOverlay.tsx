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
  /**
   * 0-indexed line numbers to pulse with an emerald band (e.g. the heading
   * line of a section the user just jumped to / inserted). Auto-clears via
   * the parent state — this component only renders.
   */
  pulseLines?: number[];
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
export function PromptHighlightOverlay({ prompt, locations, textareaRef, paddingLeftPx, conflictLines, pulseLines }: Props) {
  const overlayRef = useRef<HTMLPreElement>(null);

  // Build the overlay content as a sequence of styled segments.
  const segments = useMemo(() => {
    const lines = prompt.split('\n');

    // Build a map: line index → status for thin/ok/missing display.
    const lineStatus = new Map<number, { kind: 'thin' | 'ok'; label: string }>();
    const ghostInserts: { afterChar: number; label: string }[] = [];
    const conflictSet = new Set<number>((conflictLines ?? []).map((n) => n - 1));
    const pulseSet = new Set<number>(pulseLines ?? []);

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
      const isPulse = pulseSet.has(i);
      if (isConflict) {
        out.push({
          text: line.length > 0 ? line : ' ',
          cls: 'bg-destructive/15 text-destructive/90 border-l-2 border-destructive pl-1 -ml-1',
        });
      } else if (isPulse) {
        out.push({
          text: line.length > 0 ? line : ' ',
          cls: 'bg-nexus-emerald/20 text-nexus-emerald border-l-2 border-nexus-emerald pl-1 -ml-1 animate-pulse',
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
  }, [prompt, locations, conflictLines, pulseLines]);

  // Keep the overlay perfectly aligned with the textarea's scroll position.
  // We sync on multiple signals because the textarea can scroll without
  // emitting a `scroll` event in some flows:
  //  - `scroll`  → user wheel / drag / keyboard navigation
  //  - `input`   → typing past the viewport auto-scrolls the caret into view
  //  - `keyup`   → arrow-key caret moves that auto-scroll
  //  - `select`  → programmatic setSelectionRange after insert
  //  - ResizeObserver → textarea resized (manual resize handle, layout shift)
  //  - rAF loop on focus → catches any remaining drift while the user edits
  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;

    let rafId: number | null = null;
    let focused = false;

    const sync = () => {
      if (ov.scrollTop !== ta.scrollTop) ov.scrollTop = ta.scrollTop;
      if (ov.scrollLeft !== ta.scrollLeft) ov.scrollLeft = ta.scrollLeft;
    };

    const tick = () => {
      sync();
      if (focused) rafId = window.requestAnimationFrame(tick);
    };

    const onFocus = () => {
      focused = true;
      if (rafId == null) rafId = window.requestAnimationFrame(tick);
    };
    const onBlur = () => {
      focused = false;
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      sync();
    };

    ta.addEventListener('scroll', sync, { passive: true });
    ta.addEventListener('input', sync);
    ta.addEventListener('keyup', sync);
    ta.addEventListener('select', sync);
    ta.addEventListener('focus', onFocus);
    ta.addEventListener('blur', onBlur);

    const ro = new ResizeObserver(sync);
    ro.observe(ta);

    sync();
    if (document.activeElement === ta) onFocus();

    return () => {
      ta.removeEventListener('scroll', sync);
      ta.removeEventListener('input', sync);
      ta.removeEventListener('keyup', sync);
      ta.removeEventListener('select', sync);
      ta.removeEventListener('focus', onFocus);
      ta.removeEventListener('blur', onBlur);
      ro.disconnect();
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [textareaRef, prompt]);

  // Hide overlay when nothing to show.
  const hasSomething = locations.some((l) => l.status !== 'ok') || (conflictLines?.length ?? 0) > 0 || (pulseLines?.length ?? 0) > 0;
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
