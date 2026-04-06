---
name: Design polish v13
description: P0-P2 fixes — mobile CTA, onboarding backdrop, quick action hover, agent card height, dashboard secondary metrics, workflow canvas placeholder, deep research focus ring
type: design
---
## Sprint v13 — Product Design Strategy Fixes

### P0 (Critical)
- **Mobile CTA**: "Criar agente" text hidden on <640px, icon-only via `hidden sm:inline`
- **Onboarding backdrop**: `bg-black/60 backdrop-blur-sm`, dialog: `bg-background/95 backdrop-blur-xl border-primary/20 shadow-primary/10`
- **Quick Action hover**: Added `hover:shadow-md hover:-translate-y-[1px]` to dashboard quick action buttons

### P1 (Polish)
- **Agent cards uniform height**: Added `min-h-[180px] flex flex-col` + footer uses `mt-auto`
- **Dashboard secondary metrics**: Replaced text-center layout with icon + text side-by-side (matches primary cards)

### P2 (Refinement)
- **Workflow canvas placeholder**: Rich empty state with dashed border icon, tip text, and "add" badge
- **Deep Research textarea**: Added `focus:ring-2 focus:ring-primary/20 transition-all`
