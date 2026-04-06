#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Nexus — Generate Supabase Types (41 tables)
# Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/generate-types.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ID="tdprnylgyrogbbhgdoik"
TYPES_FILE="src/integrations/supabase/types.ts"

echo "📝 Generating TypeScript types for project $PROJECT_ID..."
npx supabase gen types typescript --project-id "$PROJECT_ID" > "$TYPES_FILE"

TABLES=$(grep -c "Row:" "$TYPES_FILE" || echo 0)
echo "✅ Types generated: $TYPES_FILE ($TABLES tables)"
echo ""
echo "📋 Next step: remove fromTable() usage from services"
echo "   Run: grep -rln 'fromTable' src/services/*.ts"
