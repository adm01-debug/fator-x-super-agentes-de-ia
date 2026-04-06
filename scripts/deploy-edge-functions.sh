#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Nexus — Deploy All Edge Functions to Supabase
# Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/deploy-edge-functions.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ID="tdprnylgyrogbbhgdoik"

echo "🔗 Linking project $PROJECT_ID..."
npx supabase link --project-ref "$PROJECT_ID"

echo ""
echo "⚡ Deploying all Edge Functions..."
DEPLOYED=0
FAILED=0

for fn_dir in supabase/functions/*/; do
  fn=$(basename "$fn_dir")
  [ "$fn" = "_shared" ] && continue

  echo -n "  → $fn ... "
  if npx supabase functions deploy "$fn" --no-verify-jwt 2>/dev/null; then
    echo "✅"
    DEPLOYED=$((DEPLOYED + 1))
  else
    echo "❌"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployed: $DEPLOYED | ❌ Failed: $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
