-- =====================================================
-- METADATA HELPER FUNCTIONS
-- Support for Data Catalog, Lineage, Impact Analysis
-- =====================================================

-- Get upstream lineage for an object (recursive)
CREATE OR REPLACE FUNCTION metadata.get_upstream_lineage(
    p_object_id UUID,
    p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
    object_id UUID,
    object_name TEXT,
    object_type TEXT,
    full_name TEXT,
    depth INTEGER,
    path JSONB
) AS $$
WITH RECURSIVE lineage_tree AS (
    -- Base case: the object itself
    SELECT 
        o.id AS object_id,
        o.name AS object_name,
        o.object_type,
        o.full_name,
        0 AS depth,
        jsonb_build_array(o.id) AS path
    FROM metadata.objects o
    WHERE o.id = p_object_id
    
    UNION ALL
    
    -- Recursive case: upstream dependencies
    SELECT 
        o.id,
        o.name,
        o.object_type,
        o.full_name,
        lt.depth + 1,
        lt.path || jsonb_build_array(o.id)
    FROM lineage_tree lt
    JOIN metadata.dependencies d ON d.source_object_id = lt.object_id
    JOIN metadata.objects o ON o.id = d.target_object_id
    WHERE lt.depth < p_max_depth
      AND NOT (lt.path @> jsonb_build_array(o.id)) -- Prevent cycles
)
SELECT * FROM lineage_tree
ORDER BY depth;
$$ LANGUAGE SQL STABLE;

-- Get downstream lineage for an object (recursive)
CREATE OR REPLACE FUNCTION metadata.get_downstream_lineage(
    p_object_id UUID,
    p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
    object_id UUID,
    object_name TEXT,
    object_type TEXT,
    full_name TEXT,
    depth INTEGER,
    path JSONB
) AS $$
WITH RECURSIVE lineage_tree AS (
    -- Base case
    SELECT 
        o.id AS object_id,
        o.name AS object_name,
        o.object_type,
        o.full_name,
        0 AS depth,
        jsonb_build_array(o.id) AS path
    FROM metadata.objects o
    WHERE o.id = p_object_id
    
    UNION ALL
    
    -- Recursive case: downstream dependencies
    SELECT 
        o.id,
        o.name,
        o.object_type,
        o.full_name,
        lt.depth + 1,
        lt.path || jsonb_build_array(o.id)
    FROM lineage_tree lt
    JOIN metadata.dependencies d ON d.target_object_id = lt.object_id
    JOIN metadata.objects o ON o.id = d.source_object_id
    WHERE lt.depth < p_max_depth
      AND NOT (lt.path @> jsonb_build_array(o.id))
)
SELECT * FROM lineage_tree
ORDER BY depth;
$$ LANGUAGE SQL STABLE;

-- Get column lineage (upstream)
CREATE OR REPLACE FUNCTION metadata.get_column_upstream_lineage(
    p_object_id UUID,
    p_column_name TEXT,
    p_max_depth INTEGER DEFAULT 5
)
RETURNS TABLE (
    source_object_id UUID,
    source_object_name TEXT,
    source_column TEXT,
    target_object_id UUID,
    target_object_name TEXT,
    target_column TEXT,
    expression TEXT,
    transformation_type TEXT,
    depth INTEGER
) AS $$
WITH RECURSIVE column_lineage AS (
    -- Base case
    SELECT 
        cl.source_object_id,
        so.name AS source_object_name,
        cl.source_column,
        cl.target_object_id,
        to_.name AS target_object_name,
        cl.target_column,
        cl.expression,
        cl.transformation_type,
        0 AS depth
    FROM metadata.columns_lineage cl
    JOIN metadata.objects so ON so.id = cl.source_object_id
    JOIN metadata.objects to_ ON to_.id = cl.target_object_id
    WHERE cl.target_object_id = p_object_id 
      AND cl.target_column = p_column_name
    
    UNION ALL
    
    -- Recursive case
    SELECT 
        cl.source_object_id,
        so.name,
        cl.source_column,
        cl.target_object_id,
        to_.name,
        cl.target_column,
        cl.expression,
        cl.transformation_type,
        clt.depth + 1
    FROM column_lineage clt
    JOIN metadata.columns_lineage cl ON cl.target_object_id = clt.source_object_id
                                      AND cl.target_column = clt.source_column
    JOIN metadata.objects so ON so.id = cl.source_object_id
    JOIN metadata.objects to_ ON to_.id = cl.target_object_id
    WHERE clt.depth < p_max_depth
)
SELECT * FROM column_lineage;
$$ LANGUAGE SQL STABLE;

-- Impact analysis: What will break if this object changes?
CREATE OR REPLACE FUNCTION metadata.analyze_impact(
    p_object_id UUID
)
RETURNS TABLE (
    affected_object_id UUID,
    affected_object_name TEXT,
    affected_object_type TEXT,
    dependency_count INTEGER,
    impact_level TEXT,
    downstream_depth INTEGER
) AS $$
WITH downstream AS (
    SELECT * FROM metadata.get_downstream_lineage(p_object_id, 10)
),
impact_summary AS (
    SELECT 
        d.object_id,
        d.object_name,
        d.object_type,
        d.depth,
        COUNT(DISTINCT dep.id) AS dependency_count
    FROM downstream d
    LEFT JOIN metadata.dependencies dep ON dep.target_object_id = d.object_id
    GROUP BY d.object_id, d.object_name, d.object_type, d.depth
)
SELECT 
    object_id,
    object_name,
    object_type,
    dependency_count,
    CASE 
        WHEN depth = 1 THEN 'critical'
        WHEN depth = 2 THEN 'high'
        WHEN depth <= 4 THEN 'medium'
        ELSE 'low'
    END AS impact_level,
    depth
FROM impact_summary
WHERE depth > 0
ORDER BY depth, dependency_count DESC;
$$ LANGUAGE SQL STABLE;

-- Search objects by name (for autocomplete)
CREATE OR REPLACE FUNCTION metadata.search_objects(
    p_organization_id UUID,
    p_search_term TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    full_name TEXT,
    object_type TEXT,
    file_path TEXT,
    repository_name TEXT,
    description TEXT,
    match_score FLOAT
) AS $$
SELECT 
    o.id,
    o.name,
    o.full_name,
    o.object_type,
    f.relative_path AS file_path,
    r.name AS repository_name,
    o.description,
    -- Simple relevance scoring
    CASE 
        WHEN o.name ILIKE p_search_term THEN 1.0
        WHEN o.full_name ILIKE p_search_term THEN 0.9
        WHEN o.name ILIKE p_search_term || '%' THEN 0.8
        WHEN o.full_name ILIKE '%' || p_search_term || '%' THEN 0.7
        WHEN o.description ILIKE '%' || p_search_term || '%' THEN 0.5
        ELSE 0.3
    END AS match_score
FROM metadata.objects o
JOIN metadata.files f ON f.id = o.file_id
JOIN metadata.repositories r ON r.id = o.repository_id
WHERE o.organization_id = p_organization_id
  AND (
    o.name ILIKE '%' || p_search_term || '%' OR
    o.full_name ILIKE '%' || p_search_term || '%' OR
    o.description ILIKE '%' || p_search_term || '%'
  )
ORDER BY match_score DESC, o.name
LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

-- Get metadata quality report
CREATE OR REPLACE FUNCTION metadata.get_quality_report(
    p_organization_id UUID,
    p_connection_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH stats AS (
        SELECT 
            COUNT(*) AS total_objects,
            COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') AS documented_objects,
            COUNT(*) FILTER (WHERE llm_validated = TRUE) AS validated_objects,
            AVG(confidence) AS avg_confidence,
            COUNT(DISTINCT file_id) AS total_files
        FROM metadata.objects
        WHERE organization_id = p_organization_id
          AND (p_connection_id IS NULL OR connection_id = p_connection_id)
    ),
    column_stats AS (
        SELECT 
            COUNT(*) AS total_columns,
            COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') AS documented_columns
        FROM metadata.columns c
        JOIN metadata.objects o ON o.id = c.object_id
        WHERE o.organization_id = p_organization_id
          AND (p_connection_id IS NULL OR o.connection_id = p_connection_id)
    ),
    lineage_stats AS (
        SELECT 
            COUNT(*) AS total_dependencies,
            COUNT(*) FILTER (WHERE column_level = TRUE) AS column_level_dependencies,
            COUNT(DISTINCT source_object_id) AS objects_with_dependencies
        FROM metadata.dependencies d
        WHERE d.organization_id = p_organization_id
    ),
    quality_scores AS (
        SELECT 
            s.total_objects,
            s.total_files,
            s.documented_objects,
            s.validated_objects,
            s.avg_confidence,
            c.total_columns,
            c.documented_columns,
            l.total_dependencies,
            l.column_level_dependencies,
            -- Calculate quality score (0-100)
            (
                (CASE WHEN s.total_objects > 0 THEN (s.documented_objects::FLOAT / s.total_objects * 25) ELSE 0 END) +
                (CASE WHEN s.total_objects > 0 THEN (s.validated_objects::FLOAT / s.total_objects * 25) ELSE 0 END) +
                (COALESCE(s.avg_confidence, 0) * 25) +
                (CASE WHEN c.total_columns > 0 THEN (c.documented_columns::FLOAT / c.total_columns * 25) ELSE 0 END)
            ) AS quality_score
        FROM stats s, column_stats c, lineage_stats l
    )
    SELECT jsonb_build_object(
        'total_objects', total_objects,
        'total_files', total_files,
        'total_columns', total_columns,
        'documented_objects', documented_objects,
        'documented_columns', documented_columns,
        'validated_objects', validated_objects,
        'total_dependencies', total_dependencies,
        'column_level_dependencies', column_level_dependencies,
        'avg_confidence', ROUND(avg_confidence::NUMERIC, 2),
        'quality_score', ROUND(quality_score::NUMERIC, 2),
        'documentation_coverage', CASE WHEN total_objects > 0 THEN ROUND((documented_objects::FLOAT / total_objects * 100)::NUMERIC, 1) ELSE 0 END,
        'validation_coverage', CASE WHEN total_objects > 0 THEN ROUND((validated_objects::FLOAT / total_objects * 100)::NUMERIC, 1) ELSE 0 END
    ) INTO result
    FROM quality_scores;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get extraction statistics for dashboard
CREATE OR REPLACE FUNCTION metadata.get_extraction_statistics(
    p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH connection_stats AS (
        SELECT 
            COUNT(*) AS total_connections,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_connections,
            SUM(total_objects) AS total_objects,
            SUM(total_columns) AS total_columns,
            AVG(extraction_quality_score) AS avg_quality_score
        FROM enterprise.github_connections
        WHERE organization_id = p_organization_id
    ),
    job_stats AS (
        SELECT 
            COUNT(*) AS total_jobs,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed_jobs,
            COUNT(*) FILTER (WHERE status = 'processing') AS active_jobs
        FROM metadata_extraction_jobs
        WHERE organization_id = p_organization_id
    ),
    recent_activity AS (
        SELECT 
            MAX(completed_at) AS last_extraction_at,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds
        FROM metadata_extraction_jobs
        WHERE organization_id = p_organization_id
          AND status = 'completed'
          AND started_at IS NOT NULL
          AND completed_at IS NOT NULL
    )
    SELECT jsonb_build_object(
        'total_connections', c.total_connections,
        'completed_connections', c.completed_connections,
        'total_objects', COALESCE(c.total_objects, 0),
        'total_columns', COALESCE(c.total_columns, 0),
        'avg_quality_score', ROUND(COALESCE(c.avg_quality_score, 0)::NUMERIC, 1),
        'total_jobs', j.total_jobs,
        'completed_jobs', j.completed_jobs,
        'failed_jobs', j.failed_jobs,
        'active_jobs', j.active_jobs,
        'last_extraction_at', r.last_extraction_at,
        'avg_extraction_duration_minutes', ROUND((COALESCE(r.avg_duration_seconds, 0) / 60)::NUMERIC, 1)
    ) INTO result
    FROM connection_stats c, job_stats j, recent_activity r;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate lineage paths (for pre-computation)
CREATE OR REPLACE FUNCTION metadata.calculate_lineage_paths(
    p_organization_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    paths_created INTEGER := 0;
BEGIN
    -- Clear existing paths for this organization
    DELETE FROM metadata.lineage_paths WHERE organization_id = p_organization_id;
    
    -- Insert new lineage paths using recursive CTE
    WITH RECURSIVE lineage_tree AS (
        -- Base case: direct dependencies
        SELECT 
            d.organization_id,
            d.target_object_id AS ancestor_id,
            d.source_object_id AS descendant_id,
            1 AS path_length,
            jsonb_build_array(d.target_object_id, d.source_object_id) AS path_objects
        FROM metadata.dependencies d
        WHERE d.organization_id = p_organization_id
        
        UNION ALL
        
        -- Recursive case: extend paths
        SELECT 
            lt.organization_id,
            lt.ancestor_id,
            d.source_object_id,
            lt.path_length + 1,
            lt.path_objects || jsonb_build_array(d.source_object_id)
        FROM lineage_tree lt
        JOIN metadata.dependencies d ON d.target_object_id = lt.descendant_id
        WHERE lt.path_length < 20 -- Prevent infinite loops
          AND d.organization_id = p_organization_id
          AND NOT (lt.path_objects @> jsonb_build_array(d.source_object_id)) -- Prevent cycles
    )
    INSERT INTO metadata.lineage_paths (organization_id, ancestor_id, descendant_id, path_length, path_objects)
    SELECT organization_id, ancestor_id, descendant_id, path_length, path_objects
    FROM lineage_tree
    ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
    
    GET DIAGNOSTICS paths_created = ROW_COUNT;
    RETURN paths_created;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA metadata TO authenticated;
