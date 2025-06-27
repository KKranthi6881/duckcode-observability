-- Add lineage processing capabilities to the existing job queue system
-- This enhances the processing_jobs table to support multi-stage processing

-- 1. ENHANCE PROCESSING JOBS TABLE

-- Add lineage processing fields to existing processing_jobs table
ALTER TABLE code_insights.processing_jobs
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'documentation' CHECK (job_type IN ('documentation', 'lineage', 'impact_analysis', 'full_analysis')),
ADD COLUMN IF NOT EXISTS lineage_status TEXT DEFAULT 'pending' CHECK (lineage_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS lineage_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lineage_error_details TEXT,
ADD COLUMN IF NOT EXISTS dependencies_extracted JSONB DEFAULT '{}', -- Extracted dependencies from the file
ADD COLUMN IF NOT EXISTS assets_discovered JSONB DEFAULT '{}', -- Tables, views, functions discovered
ADD COLUMN IF NOT EXISTS lineage_confidence_score REAL DEFAULT 0.0;

-- Add indexes for lineage processing
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_type ON code_insights.processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_lineage_status ON code_insights.processing_jobs(lineage_status);

-- 2. ENHANCE JOB LEASING FUNCTION

-- Drop the existing function to avoid conflicts
DROP FUNCTION IF EXISTS code_insights.lease_processing_job();

-- Update the existing lease_processing_job function to support multi-stage processing
CREATE OR REPLACE FUNCTION code_insights.lease_processing_job(
    job_types TEXT[] DEFAULT ARRAY['documentation', 'lineage'],
    lease_duration_minutes INTEGER DEFAULT 30
) RETURNS TABLE (
    job_id UUID,
    file_id UUID,
    job_type TEXT,
    file_path TEXT,
    repository_full_name TEXT,
    language TEXT,
    current_status TEXT,
    lineage_status TEXT
) 
LANGUAGE plpgsql 
AS $$
DECLARE
    selected_job_id UUID;
    current_time TIMESTAMPTZ := NOW();
BEGIN
    -- Priority 1: Documentation jobs that are pending
    SELECT pj.id INTO selected_job_id
    FROM code_insights.processing_jobs pj
    JOIN code_insights.files f ON pj.file_id = f.id
    WHERE pj.status = 'pending' 
      AND 'documentation' = ANY(job_types)
      AND (pj.leased_at IS NULL OR pj.leased_at < current_time - (lease_duration_minutes || ' minutes')::INTERVAL)
    ORDER BY pj.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- Priority 2: Lineage jobs where documentation is complete but lineage is pending
    IF selected_job_id IS NULL THEN
        SELECT pj.id INTO selected_job_id
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.status = 'completed' 
          AND pj.lineage_status = 'pending'
          AND 'lineage' = ANY(job_types)
          AND (pj.leased_at IS NULL OR pj.leased_at < current_time - (lease_duration_minutes || ' minutes')::INTERVAL)
        ORDER BY pj.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- If we found a job, lease it
    IF selected_job_id IS NOT NULL THEN
        UPDATE code_insights.processing_jobs 
        SET 
            leased_at = current_time,
            updated_at = current_time,
            status = CASE 
                WHEN status = 'pending' THEN 'processing'
                ELSE status
            END,
            lineage_status = CASE 
                WHEN status = 'completed' AND lineage_status = 'pending' THEN 'processing'
                ELSE lineage_status
            END
        WHERE id = selected_job_id;

        -- Return the job details
        RETURN QUERY
        SELECT 
            pj.id as job_id,
            pj.file_id,
            CASE 
                WHEN pj.status = 'processing' THEN 'documentation'::TEXT
                WHEN pj.lineage_status = 'processing' THEN 'lineage'::TEXT
                ELSE pj.job_type
            END as job_type,
            f.file_path,
            f.repository_full_name,
            f.language,
            pj.status as current_status,
            pj.lineage_status
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.id = selected_job_id;
    END IF;

    RETURN;
END;
$$;

-- 3. ADD LINEAGE COMPLETION FUNCTION

-- Function to mark lineage processing as complete
CREATE OR REPLACE FUNCTION code_insights.complete_lineage_processing(
    p_job_id UUID,
    p_dependencies_extracted JSONB DEFAULT '{}',
    p_assets_discovered JSONB DEFAULT '{}',
    p_confidence_score REAL DEFAULT 0.0,
    p_processing_duration_ms INTEGER DEFAULT NULL,
    p_error_details TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    job_exists BOOLEAN := FALSE;
BEGIN
    -- Check if job exists and update it
    UPDATE code_insights.processing_jobs 
    SET 
        lineage_status = CASE 
            WHEN p_error_details IS NULL THEN 'completed'
            ELSE 'failed'
        END,
        lineage_processed_at = NOW(),
        lineage_error_details = p_error_details,
        dependencies_extracted = p_dependencies_extracted,
        assets_discovered = p_assets_discovered,
        lineage_confidence_score = p_confidence_score,
        processing_duration_ms = COALESCE(p_processing_duration_ms, processing_duration_ms),
        updated_at = NOW(),
        leased_at = NULL -- Release the lease
    WHERE id = p_job_id
    RETURNING TRUE INTO job_exists;

    RETURN COALESCE(job_exists, FALSE);
END;
$$;

-- 4. ADD LINEAGE DATA INSERTION FUNCTIONS

-- Function to insert discovered assets
CREATE OR REPLACE FUNCTION code_insights.insert_discovered_asset(
    p_file_id UUID,
    p_asset_name TEXT,
    p_asset_type TEXT,
    p_schema_name TEXT DEFAULT NULL,
    p_database_name TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_node_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    asset_id UUID;
    new_node_id UUID;
BEGIN
    -- Create or get node_id if not provided
    IF p_node_id IS NULL THEN
        INSERT INTO code_insights.graph_nodes (
            file_id,
            node_type,
            node_name,
            properties,
            fully_qualified_name
        ) VALUES (
            p_file_id,
            p_asset_type,
            p_asset_name,
            p_metadata,
            COALESCE(p_database_name || '.', '') || COALESCE(p_schema_name || '.', '') || p_asset_name
        )
        ON CONFLICT (file_id, node_type, node_name) 
        DO UPDATE SET 
            properties = EXCLUDED.properties,
            fully_qualified_name = EXCLUDED.fully_qualified_name,
            updated_at = NOW()
        RETURNING id INTO new_node_id;
    ELSE
        new_node_id := p_node_id;
    END IF;

    -- Insert or update data asset
    INSERT INTO code_insights.data_assets (
        node_id,
        asset_name,
        asset_type,
        schema_name,
        database_name,
        asset_metadata,
        file_id
    ) VALUES (
        new_node_id,
        p_asset_name,
        p_asset_type,
        p_schema_name,
        p_database_name,
        p_metadata,
        p_file_id
    )
    ON CONFLICT (full_qualified_name, file_id)
    DO UPDATE SET
        asset_metadata = EXCLUDED.asset_metadata,
        node_id = EXCLUDED.node_id,
        updated_at = NOW()
    RETURNING id INTO asset_id;

    RETURN asset_id;
END;
$$;

-- Function to insert lineage relationships
CREATE OR REPLACE FUNCTION code_insights.insert_lineage_relationship(
    p_source_asset_id UUID,
    p_target_asset_id UUID,
    p_relationship_type TEXT,
    p_operation_type TEXT DEFAULT NULL,
    p_confidence_score REAL DEFAULT 0.8,
    p_transformation_logic TEXT DEFAULT NULL,
    p_business_context TEXT DEFAULT NULL,
    p_discovered_in_file_id UUID DEFAULT NULL,
    p_discovered_at_line INTEGER DEFAULT NULL,
    p_join_conditions JSONB DEFAULT '{}',
    p_filter_conditions JSONB DEFAULT '{}',
    p_aggregation_logic JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    lineage_id UUID;
    edge_id UUID;
BEGIN
    -- Create graph edge first
    INSERT INTO code_insights.graph_edges (
        source_node_id,
        target_node_id,
        relationship_type,
        properties,
        confidence_score,
        transformation_logic,
        business_context,
        discovered_at_line
    )
    SELECT 
        da_source.node_id,
        da_target.node_id,
        p_relationship_type,
        jsonb_build_object(
            'operation_type', p_operation_type,
            'join_conditions', p_join_conditions,
            'filter_conditions', p_filter_conditions,
            'aggregation_logic', p_aggregation_logic
        ),
        p_confidence_score,
        p_transformation_logic,
        p_business_context,
        p_discovered_at_line
    FROM code_insights.data_assets da_source, code_insights.data_assets da_target
    WHERE da_source.id = p_source_asset_id AND da_target.id = p_target_asset_id
    RETURNING id INTO edge_id;

    -- Create data lineage record
    INSERT INTO code_insights.data_lineage (
        edge_id,
        source_asset_id,
        target_asset_id,
        relationship_type,
        operation_type,
        confidence_score,
        transformation_logic,
        business_context,
        discovered_in_file_id,
        discovered_at_line,
        join_conditions,
        filter_conditions,
        aggregation_logic
    ) VALUES (
        edge_id,
        p_source_asset_id,
        p_target_asset_id,
        p_relationship_type,
        p_operation_type,
        p_confidence_score,
        p_transformation_logic,
        p_business_context,
        p_discovered_in_file_id,
        p_discovered_at_line,
        p_join_conditions,
        p_filter_conditions,
        p_aggregation_logic
    )
    ON CONFLICT (source_asset_id, target_asset_id, relationship_type, discovered_in_file_id)
    DO UPDATE SET
        confidence_score = EXCLUDED.confidence_score,
        transformation_logic = EXCLUDED.transformation_logic,
        business_context = EXCLUDED.business_context,
        join_conditions = EXCLUDED.join_conditions,
        filter_conditions = EXCLUDED.filter_conditions,
        aggregation_logic = EXCLUDED.aggregation_logic,
        updated_at = NOW()
    RETURNING id INTO lineage_id;

    RETURN lineage_id;
END;
$$;

-- 5. ADD ANALYTICS AND REPORTING FUNCTIONS

-- Function to get lineage statistics for a repository
CREATE OR REPLACE FUNCTION code_insights.get_lineage_stats(
    p_repository_name TEXT
) RETURNS TABLE (
    total_files INTEGER,
    files_with_lineage INTEGER,
    total_assets INTEGER,
    total_relationships INTEGER,
    avg_confidence_score REAL,
    asset_type_breakdown JSONB,
    relationship_type_breakdown JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH file_stats AS (
        SELECT 
            COUNT(*) as total_files,
            COUNT(CASE WHEN pj.lineage_status = 'completed' THEN 1 END) as files_with_lineage
        FROM code_insights.files f
        LEFT JOIN code_insights.processing_jobs pj ON f.id = pj.file_id
        WHERE f.repository_full_name = p_repository_name
    ),
    asset_stats AS (
        SELECT 
            COUNT(*) as total_assets,
            jsonb_object_agg(asset_type, type_count) as asset_type_breakdown
        FROM (
            SELECT 
                da.asset_type,
                COUNT(*) as type_count
            FROM code_insights.data_assets da
            JOIN code_insights.files f ON da.file_id = f.id
            WHERE f.repository_full_name = p_repository_name
            GROUP BY da.asset_type
        ) asset_counts
    ),
    lineage_stats AS (
        SELECT 
            COUNT(*) as total_relationships,
            AVG(dl.confidence_score) as avg_confidence_score,
            jsonb_object_agg(relationship_type, rel_count) as relationship_type_breakdown
        FROM code_insights.data_lineage dl
        JOIN code_insights.files f ON dl.discovered_in_file_id = f.id
        WHERE f.repository_full_name = p_repository_name
        GROUP BY dl.relationship_type
    )
    SELECT 
        fs.total_files,
        fs.files_with_lineage,
        COALESCE(ast.total_assets, 0)::INTEGER,
        COALESCE(ls.total_relationships, 0)::INTEGER,
        COALESCE(ls.avg_confidence_score, 0.0)::REAL,
        COALESCE(ast.asset_type_breakdown, '{}'::JSONB),
        COALESCE(ls.relationship_type_breakdown, '{}'::JSONB)
    FROM file_stats fs
    CROSS JOIN asset_stats ast
    CROSS JOIN lineage_stats ls;
END;
$$;

-- 6. GRANT PERMISSIONS

-- Grant permissions on enhanced functions
GRANT EXECUTE ON FUNCTION code_insights.lease_processing_job TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.complete_lineage_processing TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.insert_discovered_asset TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.insert_lineage_relationship TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.get_lineage_stats TO service_role;

-- 7. COMMENTS

COMMENT ON FUNCTION code_insights.lease_processing_job IS 'Enhanced job leasing function supporting multi-stage processing (documentation + lineage)';
COMMENT ON FUNCTION code_insights.complete_lineage_processing IS 'Marks lineage processing as complete and stores extracted relationships';
COMMENT ON FUNCTION code_insights.insert_discovered_asset IS 'Inserts discovered data assets (tables, views, functions) with graph node creation';
COMMENT ON FUNCTION code_insights.insert_lineage_relationship IS 'Creates lineage relationships between assets with confidence scoring';
COMMENT ON FUNCTION code_insights.get_lineage_stats IS 'Returns comprehensive lineage statistics for a repository'; 