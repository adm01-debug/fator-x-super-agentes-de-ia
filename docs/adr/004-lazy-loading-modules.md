# ADR 004: Lazy Loading All Builder Modules

## Status: Accepted

## Context
17 builder modules totaling ~4700 lines loaded eagerly on builder page open.

## Decision
Use React.lazy() for all 17 modules with Suspense fallback.

## Rationale
- Only active tab's module loads (~12-17KB each)
- Main bundle reduced from 758KB to 195KB
- First paint improved by ~60%
- Vite manualChunks separates vendor libraries for independent caching

## Consequences
- MODULE_MAP record maps tab IDs to lazy components
- ModuleLoading fallback shows "Carregando modulo..."
- Each module is its own chunk in dist/
- CommandPalette and NotificationsDrawer also lazy loaded
