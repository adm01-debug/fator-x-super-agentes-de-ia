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

## Completed — Sprint 18 (Coverage Gate enforcement)
- package.json: `test:coverage` + `test:coverage:ci` scripts
- vitest.config.ts: `all: true`, html reporter, reportsDirectory: 'coverage'
- .gitignore: `coverage/` excluded from VCS
- RUNBOOK.md: Coverage Gate section with thresholds (70/70/60) + policy

## Completed — Sprint 19 (Bundle-size budget guard)
- bundle-budget.json: per-chunk + total gzip KB limits (total 1200 KB)
- scripts/check-bundle-size.mjs: gzip-measures dist/assets/*.js, fails on over-budget
- package.json: `build:analyze` + `check:bundle` scripts
- .github/workflows/ci.yml: `check:bundle` step after build + uploads bundle-report.html artifact
- vite.config.ts already had visualizer + manualChunks (vendor-react, vendor-supabase, vendor-ui, vendor-query) — reused
- RUNBOOK.md: Bundle Size Budget section with strategy table + policy
- Yellow warning at >85% of limit, red fail at >100%

## Score: 10/10 ✅ (Sprint 19 complete)

## Next candidates
- Playwright auth flow E2E expansion
- Lighthouse CI integration
- Dependency freshness audit (renovate/dependabot config)

## Notes
- HIBP (leaked password protection) — manual activation in Cloud UI
- Vault encryption at rest — pgsodium extension at infra level
- Member emails visible to workspace peers — intentional for collaboration
- tool_integrations owner-only — intentional credential protection
