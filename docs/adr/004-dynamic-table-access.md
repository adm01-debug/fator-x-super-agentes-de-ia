# ADR-004: Dynamic Table Access Pattern

**Status:** Superseded  
**Date:** 2026-04-05 (Updated: 2026-04-06)  
**Context:** Some services reference tables not yet in the DB schema. Tables now created via migration `20260406000001_create_adr004_planned_tables.sql`.

## Decision
Use `(supabase as any).from('table')` cast for tables planned but not yet created.

## Rationale
- Allows writing service logic before migrations are approved
- Services for `agent_configs`, `workflow_handoffs`, `workflow_executions`, `workflow_checkpoints` anticipate future tables
- TypeScript strict mode would block access to non-existent table types

## Consequences
- These services will fail at runtime until tables are created
- Type safety is bypassed — extra care needed in these services
- Must track which tables are "planned" vs "real" in this ADR
- Goal: create all planned tables and remove `as any` casts

## Planned Tables (NOW CREATED)
| Table | Service | Priority | Status |
|-------|---------|----------|--------|
| `workflow_executions` | workflowCheckpointService | High | CREATED |
| `workflow_checkpoints` | workflowCheckpointService | High | CREATED |
| `workflow_handoffs` | agentHandoffService | Medium | CREATED |
| `agent_configs` | agentCardService | Medium | CREATED |

All tables created in migration `20260406000001_create_adr004_planned_tables.sql` with full RLS policies and indexes.
