# DESIGN.md — Nexus Agents Studio Design System

## Brand Identity
- **Primary**: #4D96FF (Nexus Blue)
- **Secondary**: #9B59B6 (Oráculo Purple)
- **Success**: #6BCB77
- **Warning**: #FFD93D
- **Danger**: #FF6B6B
- **Accent**: #E67E22 (DataHub Orange)

## Background System
- **Page**: #050510 (deepest dark)
- **Card**: #111122 (nexus-card)
- **Input**: #0a0a1a
- **Border**: #222244
- **Hover**: #1a1a2e

## Typography
- **Font**: Inter (system fallback: -apple-system, sans-serif)
- **Headers**: font-bold, text-white
- **Body**: text-sm, text-[#E0E0E0]
- **Muted**: text-[10px], text-[#888888]
- **Mono**: font-mono (for code, IDs, keys)

## Component Patterns
- **Cards**: `bg-[#111122] rounded-xl border border-[#222244] p-6`
- **Inputs**: `bg-[#0a0a1a] border border-[#222244] rounded-lg text-sm text-white`
- **Badges**: `text-[10px]` with colored borders matching context
- **Buttons Primary**: `bg-gradient-to-r from-[#4D96FF] to-[#9B59B6]`
- **Buttons Danger**: `variant="destructive"` or `bg-[#FF6B6B]`

## Layout Rules
- **Max width**: `max-w-[1400px] mx-auto`
- **Page padding**: `p-6 sm:p-8 lg:p-10`
- **Section spacing**: `space-y-6`
- **Grid**: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`

## Icon System
- Library: Lucide React
- Size in cards: `w-5 h-5`
- Size in buttons: `w-3 h-3`
- Size in badges: `w-3 h-3`

## Accessibility
- All interactive elements have hover states
- Focus rings: `focus:border-[#4D96FF] focus:outline-none`
- Tooltips for icon-only buttons
- Color contrast ratio ≥ 4.5:1 for text

## Agent-Specific Patterns
- **Status indicators**: Colored dots (●) + Badge text
- **Metric cards**: Colored top value + muted label below
- **Tab navigation**: Active = colored background, Inactive = transparent
- **Streaming cursor**: `animate-pulse text-[#4D96FF]` + ▌ character
