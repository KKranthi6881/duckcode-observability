#!/bin/bash

# Apply Unified Lineage Migration
# This script applies the unified lineage system migration to your Supabase database

echo "🚀 Applying Unified Lineage Migration..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Apply the migration
echo "📦 Applying migration: 20251104000002_unified_lineage_system.sql"
cd "$(dirname "$0")"

# Option 1: Via Supabase CLI (if linked)
if [ -f ".git/config" ]; then
    echo "Using Supabase CLI..."
    supabase db push
else
    echo "⚠️  Not a linked Supabase project"
    echo ""
    echo "Please apply the migration manually:"
    echo "1. Go to your Supabase Dashboard"
    echo "2. Navigate to SQL Editor"
    echo "3. Copy and paste the contents of:"
    echo "   supabase/migrations/20251104000002_unified_lineage_system.sql"
    echo "4. Run the SQL"
fi

echo ""
echo "✅ Migration instructions complete!"
echo ""
echo "Next steps:"
echo "1. Restart your backend server"
echo "2. Go to Data Lineage page"
echo "3. Search for 'customer'"
echo "4. Click on a Snowflake object"
echo "5. Lineage should render!"
