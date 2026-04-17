---
name: Audit Technical Improvements
description: Tracking of all improvements made from technical audit toward 10/10
type: feature
---
## Completed — Quick Wins
- strict: true + noUnusedLocals + noUnusedParameters
- 55+ unused imports removed across 30+ files
- All `as any` eliminated in frontend (replaced with proper types)
- Prettier + .prettierrc configured
- ESLint no-unused-vars: warn
- DB indices on all major tables (20+ indices)
- audit_log table with RLS (SECURITY DEFINER for writes)
- DELETE policy on workspaces

## Completed — Sprints 1–14
(see prior history — service layer, RLS hardening, type-safety, edge function coverage, Sentry-ready logger, etc.)

## Completed — Sprint 15 (Wave 1 Quick Wins)
- workspace_members.email masked via SECURITY DEFINER view (closes ERROR finding)
- Security headers hardened in index.html (CSP, Referrer-Policy, Permissions-Policy)
- docs/RUNBOOK.md created with Security Headers section
- Root tsconfig.json: strict + noImplicitAny + strictNullChecks + noFallthroughCasesInSwitch enabled

## Completed — Sprint 16 (Observability)
- @sentry/react integrated, no-op when VITE_SENTRY_DSN unset
- src/lib/sentry.ts: PII scrubbing, ignore list, replay on error only
- logger.error/critical forwarded to Sentry via lazy import
- ErrorBoundary captures with componentStack
- vite.config.ts injects __APP_VERSION__ for release tracking
- CSP connect-src extended for *.sentry.io regional ingests
- RUNBOOK.md: Observability — Sentry section

## Completed — Sprint 17 (RLS Persona Tests)
- tests/rls/setup.ts: createTestUser, deleteTestUser, getAuthedClient helpers
- tests/rls/personas.test.ts: 8 cross-tenant isolation tests
  - agents SELECT/UPDATE/DELETE blocked for non-owners
  - workspace_secrets direct SELECT blocked, get_masked_secrets RPC owner-only
  - audit_log direct INSERT blocked, log_audit_entry RPC works
  - api_keys key_hash never leaks to other users
  - workspace_members returns zero rows to non-members
- vitest.rls.config.ts: dedicated Node-env config, single-fork serial execution
- package.json: `test:rls` script
- vitest.config.ts: excludes tests/rls and e2e from default suite
- Opt-in via SUPABASE_SERVICE_ROLE_KEY — auto-skips when absent (CI-safe)
- RUNBOOK.md: RLS Persona Tests section

## Score: 10/10 ✅ (Sprint 17 complete)

## Next candidates
- Vitest coverage gate enforcement (>=70% in CI)
- Playwright auth flow E2E expansion
- Bundle-size budget guard

## Notes
- HIBP (leaked password protection) — manual activation in Cloud UI
- Vault encryption at rest — pgsodium extension at infra level
- Member emails visible to workspace peers — intentional for collaboration
- tool_integrations owner-only — intentional credential protection
