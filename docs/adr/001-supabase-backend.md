# ADR-001: Supabase as Backend

**Status:** Accepted  
**Date:** 2026-04-05  
**Context:** Need a managed backend with auth, DB, storage, and edge functions.

## Decision
Use Supabase (via Lovable Cloud) as the sole backend provider.

## Rationale
- PostgreSQL with Row Level Security (RLS) provides data isolation per user/workspace
- Built-in auth with JWT, refresh tokens, and OAuth support
- Edge Functions (Deno) for custom server logic without managing infrastructure
- Auto-generated TypeScript types from DB schema
- Real-time subscriptions for live updates

## Consequences
- All tables must have RLS policies
- Edge Functions run on Deno (not Node.js) — different API surface
- Schema changes require migrations via Lovable tooling
- No direct SSH/server access — debugging via logs only
