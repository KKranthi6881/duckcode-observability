-- Migration: Cross-File Relationship Resolution
-- This migration adds functions to resolve relationships across files in a repository

-- Function to resolve cross-file asset references
CREATE OR REPLACE FUNCTION code_insights.resolve_cross_file_assets(
    p_repository_id UUID
) RETURNS TABLE (
    source_file_id UUID,
    source_asset_name TEXT,
    target_file_id UUID,
    target_asset_name TEXT,
    relationship_type TEXT,
    confidence_score DECIMAL,
    resolution_method TEXT
) AS $$
BEGIN
    -- Return cross-file asset relationships based on naming patterns and references
    RETURN QUERY
    WITH asset_references AS (
        -- Find potential asset references in file dependencies
        SELECT 
            fd.source_file_id,
            fd.target_file_id,
            fd.import_statement,
            fd.specific_items,
            fd.confidence_score,
            'import_reference' as resolution_method
        FROM code_insights.file_dependencies fd
        JOIN code_insights.files sf ON fd.source_file_id = sf.id
        JOIN code_insights.files tf ON fd.target_file_id = tf.id
        WHERE sf.repository_id = p_repository_id
        
        UNION ALL
        
        -- Find assets with matching names across files
        SELECT 
            sa.file_id as source_file_id,
            ta.file_id as target_file_id,
            CONCAT('Asset name match: ', sa.asset_name) as import_statement,
            ARRAY[sa.asset_name] as specific_items,
            CASE 
                WHEN sa.asset_name = ta.asset_name AND sa.asset_type = ta.asset_type THEN 0.9
                WHEN sa.asset_name = ta.asset_name THEN 0.7
                ELSE 0.5
            END as confidence_score,
            'name_matching' as resolution_method
        FROM code_insights.data_assets sa
        JOIN code_insights.data_assets ta ON sa.asset_name = ta.asset_name
        JOIN code_insights.files sf ON sa.file_id = sf.id
        JOIN code_insights.files tf ON ta.file_id = tf.id
        WHERE sf.repository_id = p_repository_id
        AND sa.file_id != ta.file_id
        
        UNION ALL
        
        -- Find schema-qualified name matches
        SELECT 
            sa.file_id as source_file_id,
            ta.file_id as target_file_id,
            CONCAT('Schema qualified match: ', sa.full_qualified_name) as import_statement,
            ARRAY[sa.full_qualified_name] as specific_items,
            0.95 as confidence_score,
            'qualified_name_matching' as resolution_method
        FROM code_insights.data_assets sa
        JOIN code_insights.data_assets ta ON sa.full_qualified_name = ta.full_qualified_name
        JOIN code_insights.files sf ON sa.file_id = sf.id
        JOIN code_insights.files tf ON ta.file_id = tf.id
        WHERE sf.repository_id = p_repository_id
        AND sa.file_id != ta.file_id
        AND sa.full_qualified_name IS NOT NULL
    )
    SELECT 
        ar.source_file_id,
        COALESCE(sa.asset_name, 'unknown') as source_asset_name,
        ar.target_file_id,
        COALESCE(ta.asset_name, 'unknown') as target_asset_name,
        CASE 
            WHEN ar.resolution_method = 'import_reference' THEN 'imports'
            WHEN ar.resolution_method = 'name_matching' THEN 'references'
            WHEN ar.resolution_method = 'qualified_name_matching' THEN 'qualified_reference'
            ELSE 'unknown'
        END as relationship_type,
        ar.confidence_score,
        ar.resolution_method
    FROM asset_references ar
    LEFT JOIN code_insights.data_assets sa ON ar.source_file_id = sa.file_id
    LEFT JOIN code_insights.data_assets ta ON ar.target_file_id = ta.file_id
    WHERE ar.confidence_score >= 0.5
    ORDER BY ar.confidence_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to build dependency execution order
CREATE OR REPLACE FUNCTION code_insights.calculate_execution_order(
    p_repository_id UUID
) RETURNS TABLE (
    file_id UUID,
    file_path TEXT,
    execution_level INTEGER,
    dependencies_count INTEGER,
    dependents_count INTEGER,
    is_source BOOLEAN,
    is_sink BOOLEAN,
    criticality_score DECIMAL
) AS $$
BEGIN
    -- Calculate execution order using topological sort
    RETURN QUERY
    WITH RECURSIVE dependency_graph AS (
        -- Base case: files with no dependencies (sources)
        SELECT 
            f.id as file_id,
            f.file_path,
            0 as execution_level,
            0 as dependencies_count,
            COUNT(fd_out.target_file_id) as dependents_count,
            true as is_source,
            COUNT(fd_out.target_file_id) = 0 as is_sink
        FROM code_insights.files f
        LEFT JOIN code_insights.file_dependencies fd_in ON f.id = fd_in.target_file_id
        LEFT JOIN code_insights.file_dependencies fd_out ON f.id = fd_out.source_file_id
        WHERE f.repository_id = p_repository_id
        AND fd_in.target_file_id IS NULL -- No incoming dependencies
        GROUP BY f.id, f.file_path
        
        UNION ALL
        
        -- Recursive case: files that depend on files in previous levels
        SELECT 
            f.id as file_id,
            f.file_path,
            dg.execution_level + 1,
            COUNT(DISTINCT fd_in.source_file_id) as dependencies_count,
            COUNT(DISTINCT fd_out.target_file_id) as dependents_count,
            false as is_source,
            COUNT(DISTINCT fd_out.target_file_id) = 0 as is_sink
        FROM code_insights.files f
        JOIN code_insights.file_dependencies fd_in ON f.id = fd_in.target_file_id
        JOIN dependency_graph dg ON fd_in.source_file_id = dg.file_id
        LEFT JOIN code_insights.file_dependencies fd_out ON f.id = fd_out.source_file_id
        WHERE f.repository_id = p_repository_id
        AND f.id NOT IN (SELECT file_id FROM dependency_graph)
        GROUP BY f.id, f.file_path, dg.execution_level
    )
    SELECT 
        dg.file_id,
        dg.file_path,
        dg.execution_level,
        dg.dependencies_count,
        dg.dependents_count,
        dg.is_source,
        dg.is_sink,
        -- Calculate criticality based on position in graph
        CASE 
            WHEN dg.is_source AND dg.dependents_count > 5 THEN 0.9
            WHEN dg.is_sink AND dg.dependencies_count > 5 THEN 0.8
            WHEN dg.dependents_count > 10 THEN 0.85
            WHEN dg.dependencies_count > 10 THEN 0.7
            ELSE 0.5
        END as criticality_score
    FROM dependency_graph dg
    ORDER BY dg.execution_level, dg.criticality_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect circular dependencies
CREATE OR REPLACE FUNCTION code_insights.detect_circular_dependencies(
    p_repository_id UUID
) RETURNS TABLE (
    cycle_id UUID,
    file_path TEXT,
    dependency_path TEXT[],
    cycle_length INTEGER,
    severity TEXT
) AS $$
BEGIN
    -- Detect circular dependencies using graph traversal
    RETURN QUERY
    WITH RECURSIVE dependency_paths AS (
        -- Start from each file
        SELECT 
            f.id as start_file_id,
            f.id as current_file_id,
            f.file_path,
            ARRAY[f.file_path] as path,
            0 as depth
        FROM code_insights.files f
        WHERE f.repository_id = p_repository_id
        
        UNION ALL
        
        -- Follow dependencies
        SELECT 
            dp.start_file_id,
            fd.target_file_id as current_file_id,
            f.file_path,
            dp.path || f.file_path,
            dp.depth + 1
        FROM dependency_paths dp
        JOIN code_insights.file_dependencies fd ON dp.current_file_id = fd.source_file_id
        JOIN code_insights.files f ON fd.target_file_id = f.id
        WHERE dp.depth < 20 -- Prevent infinite loops
        AND f.file_path != ALL(dp.path) -- Prevent immediate cycles
    ),
    cycles AS (
        SELECT 
            dp.start_file_id as cycle_id,
            f.file_path,
            dp.path || f.file_path as dependency_path,
            array_length(dp.path, 1) + 1 as cycle_length
        FROM dependency_paths dp
        JOIN code_insights.files f ON dp.current_file_id = f.id
        JOIN code_insights.file_dependencies fd ON dp.current_file_id = fd.source_file_id
        WHERE fd.target_file_id = dp.start_file_id -- Cycle detected
    )
    SELECT 
        c.cycle_id,
        c.file_path,
        c.dependency_path,
        c.cycle_length,
        CASE 
            WHEN c.cycle_length <= 2 THEN 'low'
            WHEN c.cycle_length <= 5 THEN 'medium'
            ELSE 'high'
        END as severity
    FROM cycles c
    ORDER BY c.cycle_length, c.file_path;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze data flow patterns
CREATE OR REPLACE FUNCTION code_insights.analyze_data_flow_patterns(
    p_repository_id UUID
) RETURNS TABLE (
    pattern_type TEXT,
    source_files TEXT[],
    target_files TEXT[],
    data_volume_estimate INTEGER,
    transformation_complexity DECIMAL,
    business_impact TEXT,
    optimization_opportunities TEXT[]
) AS $$
BEGIN
    -- Analyze common data flow patterns
    RETURN QUERY
    WITH flow_analysis AS (
        -- ETL Patterns: Extract -> Transform -> Load
        SELECT 
            'etl_pipeline' as pattern_type,
            array_agg(DISTINCT sf.file_path) as source_files,
            array_agg(DISTINCT tf.file_path) as target_files,
            COUNT(DISTINCT dl.id) as data_volume_estimate,
            AVG(COALESCE(dl.confidence_score, 0.5)) as transformation_complexity,
            'Data pipeline processing' as business_impact,
            ARRAY['Parallel processing', 'Incremental updates', 'Error handling'] as optimization_opportunities
        FROM code_insights.data_lineage dl
        JOIN code_insights.data_assets sa ON dl.source_asset_id = sa.id
        JOIN code_insights.data_assets ta ON dl.target_asset_id = ta.id
        JOIN code_insights.files sf ON sa.file_id = sf.id
        JOIN code_insights.files tf ON ta.file_id = tf.id
        WHERE sf.repository_id = p_repository_id
        AND dl.relationship_type IN ('transforms', 'aggregates')
        
        UNION ALL
        
        -- Fan-out Patterns: One source to many targets
        SELECT 
            'fan_out' as pattern_type,
            array_agg(DISTINCT sf.file_path) as source_files,
            array_agg(DISTINCT tf.file_path) as target_files,
            COUNT(DISTINCT dl.id) as data_volume_estimate,
            AVG(COALESCE(dl.confidence_score, 0.5)) as transformation_complexity,
            'Data distribution and replication' as business_impact,
            ARRAY['Caching', 'Async processing', 'Load balancing'] as optimization_opportunities
        FROM code_insights.data_lineage dl
        JOIN code_insights.data_assets sa ON dl.source_asset_id = sa.id
        JOIN code_insights.data_assets ta ON dl.target_asset_id = ta.id
        JOIN code_insights.files sf ON sa.file_id = sf.id
        JOIN code_insights.files tf ON ta.file_id = tf.id
        WHERE sf.repository_id = p_repository_id
        GROUP BY sa.id, sf.file_path
        HAVING COUNT(DISTINCT ta.id) >= 3
        
        UNION ALL
        
        -- Fan-in Patterns: Many sources to one target
        SELECT 
            'fan_in' as pattern_type,
            array_agg(DISTINCT sf.file_path) as source_files,
            array_agg(DISTINCT tf.file_path) as target_files,
            COUNT(DISTINCT dl.id) as data_volume_estimate,
            AVG(COALESCE(dl.confidence_score, 0.5)) as transformation_complexity,
            'Data aggregation and consolidation' as business_impact,
            ARRAY['Data validation', 'Conflict resolution', 'Performance tuning'] as optimization_opportunities
        FROM code_insights.data_lineage dl
        JOIN code_insights.data_assets sa ON dl.source_asset_id = sa.id
        JOIN code_insights.data_assets ta ON dl.target_asset_id = ta.id
        JOIN code_insights.files sf ON sa.file_id = sf.id
        JOIN code_insights.files tf ON ta.file_id = tf.id
        WHERE sf.repository_id = p_repository_id
        GROUP BY ta.id, tf.file_path
        HAVING COUNT(DISTINCT sa.id) >= 3
    )
    SELECT * FROM flow_analysis
    ORDER BY data_volume_estimate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to generate impact analysis
CREATE OR REPLACE FUNCTION code_insights.generate_impact_analysis(
    p_file_id UUID,
    p_change_type TEXT DEFAULT 'modification'
) RETURNS TABLE (
    impacted_file_id UUID,
    impacted_file_path TEXT,
    impact_type TEXT,
    impact_severity TEXT,
    estimated_effort_hours DECIMAL,
    risk_factors TEXT[],
    mitigation_strategies TEXT[]
) AS $$
BEGIN
    -- Generate impact analysis for changes to a specific file
    RETURN QUERY
    WITH RECURSIVE impact_propagation AS (
        -- Direct dependencies
        SELECT 
            fd.target_file_id as impacted_file_id,
            f.file_path as impacted_file_path,
            'direct_dependency' as impact_type,
            1 as propagation_level,
            fd.confidence_score
        FROM code_insights.file_dependencies fd
        JOIN code_insights.files f ON fd.target_file_id = f.id
        WHERE fd.source_file_id = p_file_id
        
        UNION ALL
        
        -- Indirect dependencies (transitive)
        SELECT 
            fd.target_file_id as impacted_file_id,
            f.file_path as impacted_file_path,
            'indirect_dependency' as impact_type,
            ip.propagation_level + 1,
            fd.confidence_score * 0.8 -- Reduce confidence for indirect impacts
        FROM impact_propagation ip
        JOIN code_insights.file_dependencies fd ON ip.impacted_file_id = fd.source_file_id
        JOIN code_insights.files f ON fd.target_file_id = f.id
        WHERE ip.propagation_level < 5 -- Limit propagation depth
    )
    SELECT 
        ip.impacted_file_id,
        ip.impacted_file_path,
        ip.impact_type,
        CASE 
            WHEN ip.propagation_level = 1 AND ip.confidence_score > 0.8 THEN 'high'
            WHEN ip.propagation_level <= 2 AND ip.confidence_score > 0.6 THEN 'medium'
            ELSE 'low'
        END as impact_severity,
        -- Estimate effort based on impact severity and file complexity
        CASE 
            WHEN ip.propagation_level = 1 AND ip.confidence_score > 0.8 THEN 4.0
            WHEN ip.propagation_level <= 2 AND ip.confidence_score > 0.6 THEN 2.0
            ELSE 1.0
        END as estimated_effort_hours,
        -- Risk factors based on file characteristics
        CASE 
            WHEN ip.propagation_level = 1 THEN ARRAY['Breaking changes', 'Interface modifications', 'Data schema changes']
            WHEN ip.propagation_level = 2 THEN ARRAY['Cascading failures', 'Performance impacts', 'Integration issues']
            ELSE ARRAY['Monitoring required', 'Testing recommended']
        END as risk_factors,
        -- Mitigation strategies
        CASE 
            WHEN ip.propagation_level = 1 THEN ARRAY['Unit testing', 'Integration testing', 'Gradual rollout']
            WHEN ip.propagation_level = 2 THEN ARRAY['End-to-end testing', 'Performance monitoring', 'Rollback plan']
            ELSE ARRAY['Smoke testing', 'Monitoring alerts']
        END as mitigation_strategies
    FROM impact_propagation ip
    ORDER BY ip.propagation_level, ip.confidence_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve asset references across files
CREATE OR REPLACE FUNCTION code_insights.resolve_asset_references(
    p_repository_id UUID
) RETURNS INTEGER AS $$
DECLARE
    resolved_count INTEGER := 0;
    ref_record RECORD;
BEGIN
    -- Resolve asset references and create cross-file lineage relationships
    FOR ref_record IN 
        SELECT * FROM code_insights.resolve_cross_file_assets(p_repository_id)
    LOOP
        -- Insert resolved relationships into data_lineage table
        INSERT INTO code_insights.data_lineage (
            source_asset_id,
            target_asset_id,
            relationship_type,
            operation_type,
            confidence_score,
            transformation_logic,
            business_context,
            discovered_in_file_id,
            metadata
        )
        SELECT 
            sa.id as source_asset_id,
            ta.id as target_asset_id,
            ref_record.relationship_type,
            'cross_file_reference' as operation_type,
            ref_record.confidence_score,
            'Cross-file asset reference resolved automatically' as transformation_logic,
            'Asset dependency identified through cross-file analysis' as business_context,
            ref_record.source_file_id as discovered_in_file_id,
            jsonb_build_object(
                'resolution_method', ref_record.resolution_method,
                'resolved_at', NOW(),
                'source_file_path', sf.file_path,
                'target_file_path', tf.file_path
            ) as metadata
        FROM code_insights.data_assets sa
        JOIN code_insights.data_assets ta ON ta.asset_name = ref_record.target_asset_name
        JOIN code_insights.files sf ON sa.file_id = sf.id
        JOIN code_insights.files tf ON ta.file_id = tf.id
        WHERE sa.file_id = ref_record.source_file_id
        AND ta.file_id = ref_record.target_file_id
        AND sa.asset_name = ref_record.source_asset_name
        ON CONFLICT (source_asset_id, target_asset_id, relationship_type) DO UPDATE SET
            confidence_score = EXCLUDED.confidence_score,
            metadata = EXCLUDED.metadata,
            updated_at = NOW();
            
        resolved_count := resolved_count + 1;
    END LOOP;
    
    RETURN resolved_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_assets_qualified_name 
ON code_insights.data_assets (full_qualified_name) 
WHERE full_qualified_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_dependencies_resolution 
ON code_insights.file_dependencies (source_file_id, target_file_id, confidence_score);

CREATE INDEX IF NOT EXISTS idx_data_lineage_cross_file 
ON code_insights.data_lineage (source_asset_id, target_asset_id, relationship_type);

-- Grant permissions
GRANT EXECUTE ON FUNCTION code_insights.resolve_cross_file_assets TO authenticated;
GRANT EXECUTE ON FUNCTION code_insights.calculate_execution_order TO authenticated;
GRANT EXECUTE ON FUNCTION code_insights.detect_circular_dependencies TO authenticated;
GRANT EXECUTE ON FUNCTION code_insights.analyze_data_flow_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION code_insights.generate_impact_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION code_insights.resolve_asset_references TO authenticated; 