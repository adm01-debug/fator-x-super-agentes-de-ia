import { Fragment, type ReactNode } from 'react';

/** Escapes regex special characters in user input. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the text split into nodes with case-insensitive matches wrapped in
 * <mark>. Returns the original string when query is empty or has no matches.
 */
export function highlightMatch(text: string | null | undefined, query: string): ReactNode {
  if (!text) return text ?? '';
  const q = query.trim();
  if (q.length === 0) return text;
  let re: RegExp;
  try {
    re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
  } catch {
    return text;
  }
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) && part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="bg-nexus-amber/30 text-foreground rounded-sm px-0.5 -mx-0.5"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Returns true when any of the haystacks contains the (case-insensitive) needle. */
export function matchesAny(needle: string, haystacks: Array<string | null | undefined>): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  for (const h of haystacks) {
    if (h && h.toLowerCase().includes(q)) return true;
  }
  return false;
}
