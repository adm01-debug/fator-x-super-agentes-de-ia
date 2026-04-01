# ADR 002: CSS Animations over framer-motion

## Status: Accepted

## Context
framer-motion (~150KB) was used in 20 files for simple fade/slide animations.

## Decision
Remove framer-motion entirely. Use CSS @keyframes animations.

## Rationale
- 150KB removed from bundle (74% total reduction)
- CSS animations are GPU-accelerated by default
- No JS execution for animations = better INP score
- 3 keyframes cover all use cases: fade-in, stagger-in, slide-in-right

## Consequences
- `animate-fade-in`, `animate-stagger-in` classes used throughout
- No exit animations (acceptable for this app type)
- Reduced from 55 npm dependencies to 33
