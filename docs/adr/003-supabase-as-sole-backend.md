# ADR 003: Supabase as Sole Backend

## Status: Accepted

## Context
Need auth, database, storage, realtime, and serverless functions for the platform.

## Decision
Use Supabase exclusively (no custom backend server).

## Rationale
- PostgreSQL 17 + pgvector for embeddings
- Auth with JWT + RLS for row-level security on all 33+ tables
- Edge Functions (Deno) for LLM gateway and Oracle engine
- Storage for document uploads
- Realtime for live dashboard updates
- Single billing, single dashboard, single SDK

## Consequences
- All CRUD goes through supabase-js client
- RLS policies enforce authorization at DB level
- Edge Functions handle API key management (never exposed to frontend)
- 5 SQL migrations versioned in repository
