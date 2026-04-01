# ADR 005: OpenClaw as Deploy Channel, Not Core Integration

## Status: Accepted

## Context
OpenClaw is an autonomous agent runtime. Could be deeply integrated or used as a deploy target.

## Decision
Treat OpenClaw as a deploy channel (like WhatsApp, Slack) — not as core infrastructure.

## Rationale
- Security: Cisco found malicious skills in OpenClaw marketplace
- Architecture: OpenClaw is local Node.js runtime vs our SaaS platform
- Maintenance: OpenClaw renamed 3x in 3 months, original creator left for OpenAI
- Isolation: Breaking changes only affect SKILL.md generator, not core

## Consequences
- OpenClaw appears as 1 of 9 deploy channels in DeployModule
- Agent config exports as SKILL.md format when OpenClaw channel enabled
- No runtime dependency on OpenClaw — purely config export
