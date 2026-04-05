# ADR-003: Edge Functions Architecture

**Status:** Accepted  
**Date:** 2026-04-05  
**Context:** Server-side logic needed for AI, integrations, and data processing.

## Decision
Use Supabase Edge Functions (Deno) with shared utilities.

## Rationale
- `_shared/` directory for common auth, CORS, validation, rate-limiting
- Each function is a single `index.ts` file
- Zod for input validation on all endpoints
- JWT verification in code (not just config) for flexibility
- Rate limiting via shared middleware

## Consequences
- 33 edge functions deployed automatically
- All functions must handle CORS, auth, and input validation
- Shared code in `supabase/functions/_shared/`
- Cannot use Node.js-specific packages
