-- =====================================================
-- Backfill Organization IDs for Existing Analytics
-- Maps user_id to organization_id from user_organization_roles
-- SAFE: Only updates NULL values, doesn't change existing data
-- =====================================================

DO $$
DECLARE
    updated_count INTEGER;
    total_null INTEGER;
BEGIN
    -- Count how many records need backfilling
    SELECT COUNT(*) INTO total_null
    FROM duckcode.conversation_analytics
    WHERE organization_id IS NULL;
    
    RAISE NOTICE '📊 Found % conversation records without organization_id', total_null;
    
    IF total_null = 0 THEN
        RAISE NOTICE '✅ No backfilling needed - all records already have organization_id';
        RETURN;
    END IF;
    
    -- Backfill organization_id from user_organization_roles
    WITH user_org_mapping AS (
        SELECT DISTINCT ON (user_id)
            user_id::text as user_id_text,
            organization_id
        FROM enterprise.user_organization_roles
    )
    UPDATE duckcode.conversation_analytics ca
    SET organization_id = uom.organization_id
    FROM user_org_mapping uom
    WHERE ca.user_id = uom.user_id_text
      AND ca.organization_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Backfilled organization_id for % conversation records', updated_count;
    
    -- Check if any records still don't have organization_id
    SELECT COUNT(*) INTO total_null
    FROM duckcode.conversation_analytics
    WHERE organization_id IS NULL;
    
    IF total_null > 0 THEN
        RAISE WARNING '⚠️  % records still without organization_id', total_null;
        RAISE WARNING '    These are likely from users not in any organization';
        RAISE WARNING '    They will continue to work but won''t show in org analytics';
    ELSE
        RAISE NOTICE '🎉 All conversation records now have organization_id!';
    END IF;
    
    -- Also update the daily/weekly/monthly stats if they exist
    RAISE NOTICE '';
    RAISE NOTICE '📊 Updating aggregated stats tables...';
    
    -- Update daily stats
    WITH user_org_mapping AS (
        SELECT DISTINCT ON (user_id)
            user_id::text as user_id_text,
            organization_id
        FROM enterprise.user_organization_roles
    )
    UPDATE duckcode.daily_conversation_stats dcs
    SET organization_id = uom.organization_id
    FROM user_org_mapping uom
    WHERE dcs.user_id = uom.user_id_text
      AND dcs.organization_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '   - Updated % daily_conversation_stats records', updated_count;
    
    -- Update weekly stats
    WITH user_org_mapping AS (
        SELECT DISTINCT ON (user_id)
            user_id::text as user_id_text,
            organization_id
        FROM enterprise.user_organization_roles
    )
    UPDATE duckcode.weekly_conversation_stats wcs
    SET organization_id = uom.organization_id
    FROM user_org_mapping uom
    WHERE wcs.user_id = uom.user_id_text
      AND wcs.organization_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '   - Updated % weekly_conversation_stats records', updated_count;
    
    -- Update monthly stats
    WITH user_org_mapping AS (
        SELECT DISTINCT ON (user_id)
            user_id::text as user_id_text,
            organization_id
        FROM enterprise.user_organization_roles
    )
    UPDATE duckcode.monthly_conversation_stats mcs
    SET organization_id = uom.organization_id
    FROM user_org_mapping uom
    WHERE mcs.user_id = uom.user_id_text
      AND mcs.organization_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '   - Updated % monthly_conversation_stats records', updated_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Backfill complete! Analytics data is now linked to organizations.';
END $$;

-- Add organization_id column to daily/weekly/monthly stats if not exists
ALTER TABLE duckcode.daily_conversation_stats
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES enterprise.organizations(id);

ALTER TABLE duckcode.weekly_conversation_stats
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES enterprise.organizations(id);

ALTER TABLE duckcode.monthly_conversation_stats
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES enterprise.organizations(id);

-- Add indexes for org-level queries
CREATE INDEX IF NOT EXISTS idx_daily_stats_org_date 
ON duckcode.daily_conversation_stats(organization_id, usage_date DESC)
WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_stats_org_week 
ON duckcode.weekly_conversation_stats(organization_id, year, week_number)
WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_stats_org_month 
ON duckcode.monthly_conversation_stats(organization_id, year, month)
WHERE organization_id IS NOT NULL;

-- Final status message
DO $$
BEGIN
    RAISE NOTICE '📊 Added organization_id to existing aggregation tables';
    RAISE NOTICE '✅ Migration 20251017000003 complete!';
END $$;
