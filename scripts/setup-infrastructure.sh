#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Nexus Agents Studio — Full Infrastructure Setup
# Run this script after setting SUPABASE_ACCESS_TOKEN
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ID="${SUPABASE_PROJECT_ID:-tifbqkyumdxzmxyyoqlu}"
echo "🚀 Nexus Infrastructure Setup — Project: $PROJECT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Link project ──
echo "📎 Linking Supabase project..."
npx supabase link --project-ref "$PROJECT_ID"

# ── Step 2: Push all migrations ──
echo "🗄️ Pushing database migrations..."
npx supabase db push

# ── Step 3: Deploy Edge Functions ──
echo "⚡ Deploying Edge Functions..."
FUNCTIONS=(
  webhook-receiver notification-sender cron-executor
  queue-worker openclaw-proxy
)
for fn in "${FUNCTIONS[@]}"; do
  echo "  → Deploying $fn..."
  npx supabase functions deploy "$fn" --no-verify-jwt || echo "  ⚠ $fn deploy failed (may already exist)"
done

# ── Step 4: Generate updated types ──
echo "📝 Generating TypeScript types..."
npx supabase gen types typescript --project-id "$PROJECT_ID" > src/integrations/supabase/types.ts
echo "  ✅ Types written to src/integrations/supabase/types.ts"

# ── Step 5: Set secrets for Edge Functions ──
echo "🔑 Setting Edge Function secrets..."
if [ -n "${WHATSAPP_API_URL:-}" ]; then
  npx supabase secrets set WHATSAPP_API_URL="$WHATSAPP_API_URL"
  npx supabase secrets set WHATSAPP_API_KEY="$WHATSAPP_API_KEY"
  npx supabase secrets set WHATSAPP_INSTANCE="$WHATSAPP_INSTANCE"
  echo "  ✅ WhatsApp secrets set"
else
  echo "  ⏭ WhatsApp secrets skipped (WHATSAPP_API_URL not set)"
fi

if [ -n "${SLACK_BOT_TOKEN:-}" ]; then
  npx supabase secrets set SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"
  echo "  ✅ Slack secret set"
else
  echo "  ⏭ Slack secret skipped (SLACK_BOT_TOKEN not set)"
fi

if [ -n "${OPENCLAW_URL:-}" ]; then
  npx supabase secrets set OPENCLAW_URL="$OPENCLAW_URL"
  npx supabase secrets set OPENCLAW_API_TOKEN="${OPENCLAW_API_TOKEN:-}"
  echo "  ✅ OpenClaw secrets set"
else
  echo "  ⏭ OpenClaw secrets skipped (OPENCLAW_URL not set)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Infrastructure setup complete!"
echo ""
echo "📋 Manual steps remaining:"
echo "  1. Enable pg_cron extension in Supabase Dashboard"
echo "  2. Run scripts/setup-cron-jobs.sql in SQL Editor"
echo "  3. Run scripts/seed-automation.sql in SQL Editor"
echo "  4. Verify with: npm run dev"
