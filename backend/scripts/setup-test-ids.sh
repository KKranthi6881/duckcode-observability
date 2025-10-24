#!/bin/bash

# =====================================================
# Setup Test IDs for Documentation Generation
# This script helps you get the necessary IDs for testing
# =====================================================

echo "🔍 Finding test organizations and objects..."
echo ""

# Check if we're in Supabase project
if [ -f "../../supabase/config.toml" ]; then
    echo "✅ Found Supabase project"
    echo ""
    
    # Get database URL
    if [ -z "$DATABASE_URL" ]; then
        echo "⚠️  DATABASE_URL not set, using local Supabase..."
        DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
    else
        DB_URL="$DATABASE_URL"
    fi
    
    echo "📊 Step 1: Finding organizations with objects..."
    psql "$DB_URL" -c "
        SELECT 
            o.id as organization_id,
            o.name as organization_name,
            COUNT(DISTINCT obj.id) as objects_count,
            (
                SELECT COUNT(*) 
                FROM enterprise.organization_api_keys k 
                WHERE k.organization_id = o.id 
                AND k.provider = 'openai' 
                AND k.status = 'active'
            ) as has_openai_key
        FROM enterprise.organizations o
        LEFT JOIN enterprise.github_connections c ON o.id = c.organization_id
        LEFT JOIN metadata.objects obj ON c.id = obj.connection_id
        GROUP BY o.id, o.name
        HAVING COUNT(DISTINCT obj.id) > 0
        ORDER BY has_openai_key DESC, objects_count DESC
        LIMIT 5;
    "
    
    echo ""
    echo "📝 Copy an organization_id from above and paste it here:"
    read -p "Organization ID: " ORG_ID
    
    if [ -z "$ORG_ID" ]; then
        echo "❌ No organization ID provided. Exiting."
        exit 1
    fi
    
    echo ""
    echo "📊 Step 2: Finding sample objects for this organization..."
    psql "$DB_URL" -c "
        SELECT 
            obj.id as object_id,
            obj.name as object_name,
            obj.object_type,
            LENGTH(obj.definition) as code_length,
            COUNT(DISTINCT col.id) as columns,
            CASE 
                WHEN doc.id IS NOT NULL THEN 'Yes'
                ELSE 'No'
            END as already_documented
        FROM metadata.objects obj
        LEFT JOIN metadata.columns col ON obj.id = col.object_id
        LEFT JOIN metadata.object_documentation doc ON obj.id = doc.object_id AND doc.is_current = true
        WHERE obj.organization_id = '$ORG_ID'
          AND obj.definition IS NOT NULL
          AND LENGTH(obj.definition) > 50
        ORDER BY 
            doc.id IS NULL DESC,
            LENGTH(obj.definition) ASC
        LIMIT 10;
    "
    
    echo ""
    echo "📊 Step 3: Getting 3 sample object IDs..."
    OBJECT_IDS=$(psql "$DB_URL" -t -c "
        SELECT string_agg(id::text, ',')
        FROM (
            SELECT obj.id
            FROM metadata.objects obj
            LEFT JOIN metadata.object_documentation doc ON obj.id = doc.object_id AND doc.is_current = true
            WHERE obj.organization_id = '$ORG_ID'
              AND obj.definition IS NOT NULL
              AND LENGTH(obj.definition) > 50
              AND doc.id IS NULL
            ORDER BY LENGTH(obj.definition) ASC
            LIMIT 3
        ) t;
    " | tr -d ' ')
    
    if [ -z "$OBJECT_IDS" ]; then
        echo "⚠️  No undocumented objects found, getting any 3 objects..."
        OBJECT_IDS=$(psql "$DB_URL" -t -c "
            SELECT string_agg(id::text, ',')
            FROM (
                SELECT obj.id
                FROM metadata.objects obj
                WHERE obj.organization_id = '$ORG_ID'
                  AND obj.definition IS NOT NULL
                  AND LENGTH(obj.definition) > 50
                ORDER BY LENGTH(obj.definition) ASC
                LIMIT 3
            ) t;
        " | tr -d ' ')
    fi
    
    if [ -z "$OBJECT_IDS" ]; then
        echo "❌ No suitable objects found for this organization."
        echo "   Please ensure metadata extraction has completed."
        exit 1
    fi
    
    echo ""
    echo "✅ Found test data!"
    echo ""
    echo "=========================================="
    echo "📋 COPY AND RUN THESE COMMANDS:"
    echo "=========================================="
    echo ""
    echo "export TEST_ORG_ID=\"$ORG_ID\""
    echo "export TEST_OBJECT_IDS=\"$OBJECT_IDS\""
    echo ""
    echo "cd /Users/Kranthi_1/duck-main/duckcode-observability/backend"
    echo ""
    echo "# Test single object (Phase 2)"
    echo "export TEST_OBJECT_ID=\"\${TEST_OBJECT_IDS%%,*}\""
    echo "npx ts-node -r tsconfig-paths/register src/services/documentation/test-documentation-service.ts"
    echo ""
    echo "# Or test batch job (Phase 3)"
    echo "npx ts-node -r tsconfig-paths/register src/services/documentation/test-job-orchestrator.ts"
    echo ""
    echo "=========================================="
    
else
    echo "❌ Not in Supabase project directory"
    echo "   Please run this from: /Users/Kranthi_1/duck-main/duckcode-observability/backend/scripts/"
fi
