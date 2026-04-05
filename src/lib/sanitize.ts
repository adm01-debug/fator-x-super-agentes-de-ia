/**
 * Lightweight HTML sanitization utilities.
 *
 * No external dependencies -- works with pure string manipulation and RegExp.
 */

// ---------------------------------------------------------------------------
// Allowed tags (self-closing variants handled automatically)
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  'b',
  'i',
  'em',
  'strong',
  'p',
  'br',
  'ul',
  'ol',
  'li',
]);

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Matches an HTML tag (opening, closing, or self-closing).
 *
 * Capture groups:
 *  1 - optional `/` for closing tags
 *  2 - tag name
 *  3 - the rest of the tag (attributes, self-close slash, etc.)
 */
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi;

/** Matches HTML comments (`<!-- ... -->`). */
const COMMENT_RE = /<!--[\s\S]*?-->/g;

/** Matches `<![CDATA[...]]>` sections. */
const CDATA_RE = /<!\[CDATA\[[\s\S]*?\]\]>/gi;

/** Matches event-handler attributes (`onclick`, `onerror`, etc.). */
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Matches `javascript:` URIs inside attribute values. */
const JS_URI_RE = /\s+(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

/** Matches `style` attributes (can be used for CSS-based attacks). */
const STYLE_ATTR_RE = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// ---------------------------------------------------------------------------
// sanitizeHtml
// ---------------------------------------------------------------------------

/**
 * Strip dangerous HTML while preserving a small set of safe formatting tags.
 *
 * **Allowed tags:** `<b>`, `<i>`, `<em>`, `<strong>`, `<p>`, `<br>`,
 * `<ul>`, `<ol>`, `<li>`.
 *
 * **Stripped:** `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`,
 * all event-handler attributes (`onclick`, `onerror`, ...),
 * `javascript:` URIs, `style` attributes, HTML comments, and any tag
 * not in the allow-list.
 *
 * @param html - Untrusted HTML string.
 * @returns Sanitized HTML containing only the allowed tags (without
 *          attributes).
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let result = html;

  // 1. Remove comments and CDATA
  result = result.replace(COMMENT_RE, '');
  result = result.replace(CDATA_RE, '');

  // 2. Remove content of dangerous block-level tags entirely
  //    (e.g. everything between <script>...</script>)
  const dangerousBlocks = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'noscript'];
  for (const tag of dangerousBlocks) {
    const blockRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    result = result.replace(blockRe, '');
  }

  // 3. Process remaining tags -- keep allowed ones (without attributes),
  //    strip everything else.
  result = result.replace(TAG_RE, (match, tagName: string) => {
    const lower = tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(lower)) {
      return '';
    }

    // Determine if closing tag
    const isClosing = match.charAt(1) === '/';
    const isSelfClosing = lower === 'br';

    if (isClosing) {
      return isSelfClosing ? '' : `</${lower}>`;
    }

    return isSelfClosing ? `<${lower} />` : `<${lower}>`;
  });

  return result;
}

// ---------------------------------------------------------------------------
// escapeForAttribute
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe inclusion inside an HTML attribute value.
 *
 * Replaces the five characters that are meaningful in HTML attribute contexts:
 * `&`, `"`, `'`, `<`, `>`.
 *
 * @param value - The raw string to escape.
 * @returns A string safe to embed in a quoted HTML attribute.
 *
 * @example
 * ```ts
 * const safe = escapeForAttribute('He said "hello" & <goodbye>');
 * // 'He said &quot;hello&quot; &amp; &lt;goodbye&gt;'
 * ```
 */
export function escapeForAttribute(value: string): string {
  if (!value) return '';

  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
