# Changelog

## [1.0.0] - 2026-04-01

### Added
- 17 Agent Builder modules (Identity through Playground)
- Super Cerebro page (8 tabs, 10 engines)
- Oraculo page (5 tabs, 12 presets, 5 modes, Consensus Matrix)
- DataHub page (10 tabs, 5 real database connections, 12 entities)
- 25 pages total (Dashboard, Agents, Builder, Detail, Settings, Team, etc.)
- Full Supabase integration (Auth, CRUD, RLS)
- agentService.ts with save/load/delete/duplicate
- useAutoSave hook (5s debounce)
- 6 agent templates with full configs
- PlaygroundModule with simulated chat + feedback
- Agent Card (A2A format) in BlueprintModule
- Health Map visual architecture in BlueprintModule
- Canary Deploy + Rollback in DeployModule
- A2A Protocol in OrchestrationModule
- Agent-as-API with SDK snippets in DeployModule
- ACE Playbooks (Stanford ICLR 2026) in PromptModule
- Forensic Snapshots in GuardrailsModule
- CommandPalette searching real agents
- 9 deploy channels (API, WhatsApp, Web, Slack, Bitrix24, Telegram, Discord, Email, OpenClaw)

### Database
- 5 SQL migrations, 33+ tables with RLS
- DataHub Identity Resolution (cross-DB matching)
- Data Quality dashboard (23 gaps from stress test)
- Workspace multi-tenancy with auto-create trigger
- workspace_secrets with key_hint (never expose values)

### Performance
- Bundle: 758KB → 195KB (-74%)
- 17 modules lazy loaded
- framer-motion removed (CSS animations)
- 25 unused shadcn components deleted
- 22 unused npm packages removed
- Google Fonts via preconnect
- Vite manualChunks for vendor splitting

### Quality
- 62 tests (unit + integration)
- TypeScript strict (zero errors)
- Zod validation schemas
- GitHub Actions CI pipeline
- Husky pre-commit hooks
- Structured logger
- 5 ADRs documented
- README, RUNBOOK, ONBOARDING, DATABASE-ER docs
