/**
 * traceBookmarks — persist per-execution step bookmarks with optional notes.
 *
 * Storage: single localStorage key holding a map of `session_id -> Bookmark[]`.
 * Capped to MAX_SESSIONS entries (LRU by last write) and MAX_BOOKMARKS per session
 * to avoid unbounded growth. All operations are sync and best-effort: quota or
 * disabled storage simply no-ops.
 */

export interface TraceBookmark {
  /** trace.id of the bookmarked event (stable across reloads). */
  traceId: string;
  /** Step index at the time of bookmarking — used as a fast-path. */
  stepIndex: number;
  /** Free-text note (may be empty). */
  note: string;
  /** ISO timestamp when the bookmark was created/updated. */
  updatedAt: string;
}

const STORAGE_KEY = 'nexus.traces.bookmarks';
const MAX_SESSIONS = 50;
const MAX_BOOKMARKS = 100;

type BookmarkMap = Record<string, TraceBookmark[]>;

function readAll(): BookmarkMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BookmarkMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: BookmarkMap) {
  try {
    // Cap to last MAX_SESSIONS entries — Object.entries preserves insertion order in V8/JS engines
    // we care about, and we re-insert each touched session to keep LRU semantics.
    const entries = Object.entries(map).slice(-MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota or disabled — silently ignore */
  }
}

export function listBookmarks(sessionId: string): TraceBookmark[] {
  if (!sessionId) return [];
  const all = readAll();
  return all[sessionId] ?? [];
}

export function upsertBookmark(
  sessionId: string,
  bookmark: TraceBookmark,
): TraceBookmark[] {
  if (!sessionId || !bookmark.traceId) return [];
  const all = readAll();
  const list = all[sessionId] ?? [];
  const existing = list.findIndex((b) => b.traceId === bookmark.traceId);
  const next: TraceBookmark = { ...bookmark, updatedAt: new Date().toISOString() };
  let updated: TraceBookmark[];
  if (existing >= 0) {
    updated = [...list];
    updated[existing] = next;
  } else {
    updated = [...list, next].slice(-MAX_BOOKMARKS);
  }
  // Sort by stepIndex for stable rendering.
  updated.sort((a, b) => a.stepIndex - b.stepIndex);
  // Re-insert key to refresh LRU ordering.
  delete all[sessionId];
  all[sessionId] = updated;
  writeAll(all);
  return updated;
}

export function removeBookmark(sessionId: string, traceId: string): TraceBookmark[] {
  if (!sessionId || !traceId) return [];
  const all = readAll();
  const list = all[sessionId];
  if (!list) return [];
  const updated = list.filter((b) => b.traceId !== traceId);
  if (updated.length === 0) delete all[sessionId];
  else all[sessionId] = updated;
  writeAll(all);
  return updated;
}

export function findBookmark(
  sessionId: string,
  traceId: string,
): TraceBookmark | undefined {
  return listBookmarks(sessionId).find((b) => b.traceId === traceId);
}
