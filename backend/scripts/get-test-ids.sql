-- =====================================================
-- GET TEST IDs FOR DOCUMENTATION GENERATION
-- Run this to get organization and object IDs for testing
-- =====================================================

-- 1. Get Organizations (pick one that has an OpenAI API key)
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(DISTINCT c.id) as connections_count,
    COUNT(DISTINCT obj.id) as objects_count,
    (
        SELECT COUNT(*) 
        FROM enterprise.organization_api_keys k 
        WHERE k.organization_id = o.id 
        AND k.provider = 'openai' 
        AND k.status = 'active'
        AND k.is_default = true
    ) as has_openai_key
FROM enterprise.organizations o
LEFT JOIN enterprise.github_connections c ON o.id = c.organization_id
LEFT JOIN metadata.objects obj ON c.id = obj.connection_id
GROUP BY o.id, o.name
HAVING COUNT(DISTINCT obj.id) > 0
ORDER BY has_openai_key DESC, objects_count DESC
LIMIT 5;

-- 2. Get Sample Objects (for the organization you selected above)
-- Replace 'your-org-id' with the organization_id from step 1
SELECT 
    obj.id as object_id,
    obj.name as object_name,
    obj.object_type,
    obj.schema_name,
    LENGTH(obj.definition) as code_length,
    COUNT(DISTINCT col.id) as column_count,
    COUNT(DISTINCT dep.id) as dependency_count,
    -- Check if already documented
    CASE 
        WHEN doc.id IS NOT NULL THEN '✅ Already documented'
        ELSE '❌ Not documented'
    END as documentation_status
FROM metadata.objects obj
LEFT JOIN metadata.columns col ON obj.id = col.object_id
LEFT JOIN metadata.dependencies dep ON obj.id = dep.object_id
LEFT JOIN metadata.object_documentation doc ON obj.id = doc.object_id AND doc.is_current = true
WHERE obj.organization_id = 'your-org-id'  -- REPLACE THIS!
  AND obj.definition IS NOT NULL  -- Must have code
  AND LENGTH(obj.definition) > 50  -- Not too small
ORDER BY 
    doc.id IS NULL DESC,  -- Prioritize undocumented
    LENGTH(obj.definition) ASC  -- Start with simpler objects
LIMIT 10;

-- 3. Check if OpenAI API Key is configured
-- Replace 'your-org-id' with the organization_id from step 1
SELECT 
    id,
    provider,
    key_name,
    is_default,
    status,
    created_at
FROM enterprise.organization_api_keys
WHERE organization_id = 'your-org-id'  -- REPLACE THIS!
  AND provider = 'openai';

-- 4. Quick summary for export
-- Replace 'your-org-id' with the organization_id from step 1
DO $$
DECLARE
    v_org_id UUID := 'your-org-id';  -- REPLACE THIS!
    v_obj_ids TEXT;
BEGIN
    -- Get first 3 object IDs
    SELECT string_agg(id::text, ',')
    INTO v_obj_ids
    FROM (
        SELECT obj.id
        FROM metadata.objects obj
        LEFT JOIN metadata.object_documentation doc ON obj.id = doc.object_id AND doc.is_current = true
        WHERE obj.organization_id = v_org_id
          AND obj.definition IS NOT NULL
          AND LENGTH(obj.definition) > 50
          AND doc.id IS NULL  -- Only undocumented
        ORDER BY LENGTH(obj.definition) ASC
        LIMIT 3
    ) t;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'COPY THESE VALUES TO YOUR TERMINAL:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'export TEST_ORG_ID="%"', v_org_id;
    RAISE NOTICE 'export TEST_OBJECT_IDS="%"', v_obj_ids;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Then run:';
    RAISE NOTICE 'cd /Users/Kranthi_1/duck-main/duckcode-observability/backend';
    RAISE NOTICE 'npx ts-node -r tsconfig-paths/register src/services/documentation/test-job-orchestrator.ts';
    RAISE NOTICE '========================================';
END $$;
