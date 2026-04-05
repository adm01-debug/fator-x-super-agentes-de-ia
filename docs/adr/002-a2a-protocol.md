# ADR-002: A2A Protocol for Agent Interoperability

**Status:** Accepted  
**Date:** 2026-04-05  
**Context:** Agents need to discover and communicate with each other.

## Decision
Implement the A2A (Agent-to-Agent) Protocol for agent discovery and handoffs.

## Rationale
- Standard Agent Card format for discovery (`/.well-known/agent-card.json`)
- Typed handoff protocol with context transfer
- Supports triage → specialist → escalation patterns
- Compatible with MCP for tool-use scenarios

## Consequences
- Each agent can publish an Agent Card with skills, capabilities, and auth
- Handoff service manages state transfer between agents
- Custom expressions in handoff rules use declarative syntax (not eval)
- Agent Cards cached in `agent_configs.metadata` for performance
