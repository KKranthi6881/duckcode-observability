#!/bin/bash

echo "🔄 Applying Budget Guardrails & Security Monitoring Migrations..."
echo ""

# Get Supabase connection details
SUPABASE_URL="${SUPABASE_URL:-$(grep SUPABASE_URL .env | cut -d '=' -f2)}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2)}"

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: SUPABASE_URL not found. Set it in .env file."
    exit 1
fi

echo "📊 Applying migration: 20251105000000_budget_guardrails.sql"
echo "This creates:"
echo "  - snowflake_budgets table"
echo "  - snowflake_budget_alerts table"
echo "  - snowflake_budget_snapshots table"
echo ""

echo "🔐 Applying migration: 20251105000001_security_access_monitoring.sql"
echo "This creates:"
echo "  - snowflake_user_costs table"
echo "  - snowflake_access_patterns table"
echo "  - snowflake_role_permissions table"
echo "  - v_top_expensive_users view"
echo "  - v_security_issues view"
echo ""

echo "⚠️  Please apply these migrations manually via Supabase Dashboard:"
echo ""
echo "1. Go to: https://app.supabase.com"
echo "2. Select your project"
echo "3. Go to SQL Editor"
echo "4. Run the following files in order:"
echo "   a) supabase/migrations/20251105000000_budget_guardrails.sql"
echo "   b) supabase/migrations/20251105000001_security_access_monitoring.sql"
echo ""
echo "Or use Supabase CLI:"
echo "  supabase db push"
echo ""
