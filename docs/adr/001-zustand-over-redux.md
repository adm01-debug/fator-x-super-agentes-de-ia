# ADR 001: Zustand over Redux for State Management

## Status: Accepted

## Context
Need a global state management solution for the Agent Builder with 17 modules that read/write agent configuration.

## Decision
Use Zustand instead of Redux/Redux Toolkit.

## Rationale
- Zero boilerplate (no actions, reducers, selectors)
- 1.1KB gzipped vs 11KB for Redux Toolkit
- Works with React.lazy (no Provider needed at root)
- Direct mutation pattern (immer-like) fits our use case
- Single store with computed values (getReadinessScore, getCompleteness)

## Consequences
- All 17 modules use `useAgentBuilderStore` directly
- Auto-save implemented via useAutoSave hook (5s debounce)
- No middleware complexity — service calls in store actions
