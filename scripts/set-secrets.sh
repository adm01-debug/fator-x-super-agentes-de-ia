#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Nexus — Configure Edge Function Secrets
# Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/set-secrets.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ID="tdprnylgyrogbbhgdoik"

echo "🔗 Linking project $PROJECT_ID..."
npx supabase link --project-ref "$PROJECT_ID"

echo ""
echo "🔑 Setting Edge Function secrets..."

# WhatsApp (Evolution API)
if [ -n "${WHATSAPP_API_URL:-}" ]; then
  npx supabase secrets set \
    WHATSAPP_API_URL="$WHATSAPP_API_URL" \
    WHATSAPP_API_KEY="${WHATSAPP_API_KEY:-}" \
    WHATSAPP_INSTANCE="${WHATSAPP_INSTANCE:-promo-brindes}"
  echo "  ✅ WhatsApp secrets set"
else
  echo "  ⏭ WhatsApp (set WHATSAPP_API_URL to configure)"
fi

# Slack
if [ -n "${SLACK_BOT_TOKEN:-}" ]; then
  npx supabase secrets set SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"
  echo "  ✅ Slack secret set"
else
  echo "  ⏭ Slack (set SLACK_BOT_TOKEN to configure)"
fi

# OpenClaw
if [ -n "${OPENCLAW_URL:-}" ]; then
  npx supabase secrets set \
    OPENCLAW_URL="$OPENCLAW_URL" \
    OPENCLAW_API_TOKEN="${OPENCLAW_API_TOKEN:-}"
  echo "  ✅ OpenClaw secrets set"
else
  echo "  ⏭ OpenClaw (set OPENCLAW_URL to configure)"
fi

echo ""
echo "✅ Secrets configuration complete!"
