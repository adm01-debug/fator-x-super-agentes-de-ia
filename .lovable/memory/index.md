# Project Memory

## Core
PT-BR interface, agent builder platform (Fator X). Supabase Cloud backend.
TypeScript strict: true. Zero `as any`. Prettier configured.
ESLint with no-unused-vars: warn (ignore _prefixed).
Zod schemas in src/lib/validations/. Structured logger in src/lib/logger.ts.
Audit via RPC log_audit_entry() — never direct INSERT on audit_log.
Min font size 11px (WCAG). Sidebar sections collapsible with persistence.
All colors use nexus-* design tokens (no hardcoded Tailwind colors).
All page titles in PT-BR. PageHeader uses gradient text by default.
All pages use standard spacing: p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter
Typography: Space Grotesk headings with negative letter-spacing, Inter body at line-height 1.6
Glass morphism on dialogs and header. Grain texture on main layout.
CSP + Permissions-Policy + Referrer-Policy injected via meta in index.html. HSTS/X-Frame-Options come from Lovable CDN edge.
Sentry SDK ready (no-op until VITE_SENTRY_DSN set). PII scrubbing in beforeSend.
RLS persona tests in tests/rls/ — opt-in via SUPABASE_SERVICE_ROLE_KEY, run with `npm run test:rls`.

## Memories
- [Audit improvements](mem://features/audit-improvements) — All completed improvements tracking
- [Design polish v2](mem://design/design-polish-v2) — 15 design improvements: contrast, typography, spacing, sidebar, cards, mobile
- [Design polish v3](mem://design/design-polish-v3) — 10 final improvements: logo, footer, colors, animations, tooltips
- [Design polish v7](mem://design/design-polish-v7) — PT-BR page titles, gradient headers, card polish, automation page refactor
- [Design polish v8](mem://design/design-polish-v8) — Distinct admin icons, workspace upgrade CTA, Google avatar, sidebar badges, card hover glow
- [Design polish v10](mem://design/design-polish-v10) — Page-enter animations, reduced-motion, focus-visible, selection color
- [Design polish v11](mem://design/design-polish-v11) — Typography premium, glass morphism, grain texture, unified spacing, skeletons, empty states
- [Design polish v12](mem://design/design-polish-v12) — Card glow borders, sidebar polish, gradient CTAs, premium focus rings
- [Design polish v13](mem://design/design-polish-v13) — Mobile CTA, onboarding backdrop, agent card heights, workflow canvas, deep research input
- [DataHub audit](mem://features/datahub-audit) — 15 SQL matching/quality issues found
- [Gap analysis](mem://features/gap-analysis-gemini) — 6 gaps identified, 3 real, 2 v2.0, 1 cosmetic
