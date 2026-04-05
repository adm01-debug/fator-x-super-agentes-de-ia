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

## Automation Center Architecture

### Service Layer (10 services)
```
cronSchedulerService     → Cron parsing, scheduling, presets
webhookTriggerService    → Webhook endpoints, HMAC auth, transform
retryEngineService       → Retry policies, circuit breaker, dead letter
credentialVaultService   → AES-256-GCM encryption, rotation, audit
notificationEngineService → Multi-channel (7), templates, delivery tracking
automationTemplateService → Pre-built recipes, install/uninstall
executionHistoryService  → Audit trail, replay, compare, timeline
connectorRegistryService → Integration catalog, health checks, usage
queueManagerService      → FIFO/LIFO/Priority queues, concurrency
batchProcessorService    → Batch processing, progress, ETA
```

### Edge Functions (5 automation EFs)
```
webhook-receiver      → Receives external events, validates auth
notification-sender   → Sends via Email/WhatsApp/Slack/Push
cron-executor         → Checks due schedules, triggers targets
queue-worker          → Dequeues and processes items
openclaw-proxy        → Proxies to OpenClaw VPS
```

### Workflow Nodes (6 automation nodes)
```
cron_trigger       ⏰ → Schedule-based trigger
webhook_trigger    🔗 → External event trigger
send_notification  🔔 → Multi-channel notification
enqueue            📥 → Add to queue
batch_process      📦 → Batch processing
api_connector      🔌 → External API via registry
```

### SQL Tables (17 tables)
```
cron_schedules, cron_schedule_executions,
webhook_endpoints, webhook_events,
dead_letter_queue,
credential_vault, credential_audit_logs,
notifications, notification_templates,
automation_templates, installed_templates,
execution_history,
connector_registry, connector_instances,
task_queues, queue_items,
batch_jobs
```

### UI Components
- **AutomationCenterPage**: Hub with 9 tabs at `/automation`
- **9 Panels**: CronScheduler, WebhookManager, NotificationCenter,
  AutomationTemplates, ExecutionHistory, ConnectorRegistry,
  QueueMonitor, CredentialVault, BatchProcessor
- **AutomationOverviewWidget**: Dashboard card with key metrics
- **Sidebar**: Zap icon → /automation

### Hooks
- `useAutomation`: Aggregated dashboard stats with auto-refresh
- `useNotifications`: In-app notification polling + unread count
- `useRetryAction`: Retry + circuit breaker wrapper for components

### Color Coding
- Schedules: `#4D96FF` (Primary Blue)
- Webhooks: `#9B59B6` (Purple)
- Notifications: `#6BCB77` (Green)
- Templates: `#E67E22` (Orange)
- Queues: `#FF6B6B` (Red)
- Credentials: `#9B59B6` (Purple)
- Batch: `#6BCB77` (Green)
