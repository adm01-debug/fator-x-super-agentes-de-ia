# ADR-005: Client-Side RBAC with Server-Side RLS

**Status:** Accepted  
**Date:** 2026-04-05  
**Context:** Need role-based access control for UI and data.

## Decision
Implement RBAC at two layers: client-side `useRBAC` hook for UI, server-side RLS for data.

## Rationale
- `useRBAC` hook + `AccessControl` component hide UI elements based on role
- RLS policies enforce data access at the database level (can't be bypassed)
- `workspace_members.role` stores user roles per workspace
- `get_user_workspace_ids()` SECURITY DEFINER function prevents RLS recursion

## Consequences
- UI enforcement is UX only — not a security boundary
- All security-critical access must be enforced by RLS
- Edge Functions should validate roles server-side for mutations
- Role changes must go through workspace admin flow
