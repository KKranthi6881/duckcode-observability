-- Migration: Advanced Cross-Language Dependency Resolution
-- Phase 2D: Comprehensive impact analysis and dependency tracking for all programming languages

-- =====================================================
-- 1. ENHANCED DEPENDENCY RESOLUTION TABLES
-- =====================================================

-- Repository-wide dependency summary
CREATE TABLE IF NOT EXISTS code_insights.repository_dependency_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL,
    total_files INTEGER DEFAULT 0,
    total_assets INTEGER DEFAULT 0,
    total_columns INTEGER DEFAULT 0,
    total_functions INTEGER DEFAULT 0,
    total_dependencies INTEGER DEFAULT 0,
    dependency_depth INTEGER DEFAULT 0,
    circular_dependencies INTEGER DEFAULT 0,
    language_distribution JSONB DEFAULT '{}',
    complexity_score REAL DEFAULT 0,
    last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-language asset mapping (for assets that exist in multiple languages)
CREATE TABLE IF NOT EXISTS code_insights.cross_language_asset_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_asset_name TEXT NOT NULL,
    primary_asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id),
    related_asset_ids UUID[] DEFAULT '{}',
    languages TEXT[] DEFAULT '{}',
    asset_type TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.8,
    mapping_method TEXT CHECK (mapping_method IN ('name_exact', 'name_fuzzy', 'schema_match', 'manual', 'ml_inference')),
    business_context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced column-level dependency tracking with cross-file support
CREATE TABLE IF NOT EXISTS code_insights.column_dependency_graph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_column_id UUID NOT NULL REFERENCES code_insights.data_columns(id),
    target_column_id UUID NOT NULL REFERENCES code_insights.data_columns(id),
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('direct_copy', 'calculation', 'aggregation', 'join_key', 'filter_condition', 'transformation', 'concatenation', 'lookup')),
    transformation_expression TEXT,
    business_rule TEXT,
    confidence_score REAL DEFAULT 0.8,
    discovered_in_file_id UUID REFERENCES code_insights.files(id),
    discovered_at_line INTEGER,
    execution_order INTEGER DEFAULT 1,
    performance_impact TEXT CHECK (performance_impact IN ('none', 'low', 'medium', 'high', 'critical')),
    data_quality_impact TEXT CHECK (data_quality_impact IN ('improves', 'maintains', 'degrades', 'unknown')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to analyze complete column impact
CREATE OR REPLACE FUNCTION code_insights.analyze_column_impact(
    p_column_id UUID,
    p_change_type TEXT DEFAULT 'modification',
    p_max_depth INTEGER DEFAULT 10
) RETURNS TABLE (
    impact_level INTEGER,
    impacted_column_id UUID,
    impacted_column_name TEXT,
    impacted_asset_name TEXT,
    impacted_file_path TEXT,
    impact_type TEXT,
    impact_severity TEXT,
    transformation_chain TEXT[],
    business_impact TEXT,
    fix_complexity TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE column_impact_tree AS (
        -- Base case: Direct column dependencies
        SELECT 
            1 as level,
            cdg.target_column_id as impacted_column_id,
            dc.column_name as impacted_column_name,
            da.asset_name as impacted_asset_name,
            f.file_path as impacted_file_path,
            cdg.dependency_type as impact_type,
            CASE 
                WHEN cdg.dependency_type IN ('direct_copy', 'join_key') THEN 'high'
                WHEN cdg.dependency_type IN ('calculation', 'transformation') THEN 'medium'
                ELSE 'low'
            END as impact_severity,
            ARRAY[cdg.transformation_expression] as transformation_chain,
            cdg.business_rule as business_impact,
            CASE 
                WHEN cdg.confidence_score > 0.9 THEN 'low'
                WHEN cdg.confidence_score > 0.7 THEN 'medium'
                ELSE 'high'
            END as fix_complexity
        FROM code_insights.column_dependency_graph cdg
        JOIN code_insights.data_columns dc ON cdg.target_column_id = dc.id
        JOIN code_insights.data_assets da ON dc.asset_id = da.id
        JOIN code_insights.files f ON da.file_id = f.id
        WHERE cdg.source_column_id = p_column_id
        
        UNION ALL
        
        -- Recursive case: Indirect dependencies
        SELECT 
            cit.level + 1,
            cdg.target_column_id,
            dc.column_name,
            da.asset_name,
            f.file_path,
            cdg.dependency_type,
            CASE 
                WHEN cdg.dependency_type IN ('direct_copy', 'join_key') AND cit.impact_severity = 'high' THEN 'high'
                WHEN cdg.dependency_type IN ('calculation', 'transformation') THEN 'medium'
                ELSE 'low'
            END,
            cit.transformation_chain || cdg.transformation_expression,
            COALESCE(cdg.business_rule, cit.business_impact),
            CASE 
                WHEN cit.level > 3 THEN 'high'
                WHEN cdg.confidence_score < 0.7 THEN 'high'
                ELSE 'medium'
            END
        FROM column_impact_tree cit
        JOIN code_insights.column_dependency_graph cdg ON cit.impacted_column_id = cdg.source_column_id
        JOIN code_insights.data_columns dc ON cdg.target_column_id = dc.id
        JOIN code_insights.data_assets da ON dc.asset_id = da.id
        JOIN code_insights.files f ON da.file_id = f.id
        WHERE cit.level < p_max_depth
    )
    SELECT 
        cit.level,
        cit.impacted_column_id,
        cit.impacted_column_name,
        cit.impacted_asset_name,
        cit.impacted_file_path,
        cit.impact_type,
        cit.impact_severity,
        cit.transformation_chain,
        cit.business_impact,
        cit.fix_complexity
    FROM column_impact_tree cit
    ORDER BY cit.level, cit.impact_severity DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze file impact
CREATE OR REPLACE FUNCTION code_insights.analyze_file_impact(
    p_file_id UUID,
    p_change_type TEXT DEFAULT 'modification',
    p_max_depth INTEGER DEFAULT 10
) RETURNS TABLE (
    impact_level INTEGER,
    impacted_file_id UUID,
    impacted_file_path TEXT,
    impacted_assets TEXT[],
    impact_type TEXT,
    impact_severity TEXT,
    dependency_chain TEXT[],
    execution_order_impact BOOLEAN,
    business_impact TEXT,
    recommended_actions TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE file_impact_tree AS (
        -- Direct file dependencies
        SELECT 
            1 as level,
            fd.target_file_id as impacted_file_id,
            f.file_path as impacted_file_path,
            ARRAY_AGG(da.asset_name) as impacted_assets,
            fd.dependency_type as impact_type,
            CASE 
                WHEN fd.dependency_type IN ('imports', 'executes') THEN 'high'
                WHEN fd.dependency_type IN ('references', 'includes') THEN 'medium'
                ELSE 'low'
            END as impact_severity,
            ARRAY[f_source.file_path] as dependency_chain,
            false as execution_order_impact,
            'Direct dependency impact' as business_impact,
            CASE 
                WHEN fd.dependency_type = 'imports' THEN ARRAY['Update import statements', 'Test dependent functionality']
                WHEN fd.dependency_type = 'executes' THEN ARRAY['Review execution logic', 'Update orchestration']
                ELSE ARRAY['Review references', 'Update documentation']
            END as recommended_actions
        FROM code_insights.file_dependencies fd
        JOIN code_insights.files f ON fd.target_file_id = f.id
        JOIN code_insights.files f_source ON fd.source_file_id = f_source.id
        LEFT JOIN code_insights.data_assets da ON f.id = da.file_id
        WHERE fd.source_file_id = p_file_id
        GROUP BY fd.target_file_id, f.file_path, fd.dependency_type, f_source.file_path
    )
    SELECT 
        fit.level,
        fit.impacted_file_id,
        fit.impacted_file_path,
        fit.impacted_assets,
        fit.impact_type,
        fit.impact_severity,
        fit.dependency_chain,
        fit.execution_order_impact,
        fit.business_impact,
        fit.recommended_actions
    FROM file_impact_tree fit
    ORDER BY fit.level, fit.impact_severity DESC;
END;
$$ LANGUAGE plpgsql;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_column_dependency_graph_source ON code_insights.column_dependency_graph(source_column_id);
CREATE INDEX IF NOT EXISTS idx_column_dependency_graph_target ON code_insights.column_dependency_graph(target_column_id);
