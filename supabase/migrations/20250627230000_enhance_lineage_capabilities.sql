-- Enhance existing code_insights schema with advanced lineage capabilities
-- This builds on the existing graph_nodes and graph_edges tables

-- 1. ENHANCE EXISTING TABLES

-- Add more detailed asset tracking to the existing files table
ALTER TABLE code_insights.files 
ADD COLUMN IF NOT EXISTS complexity_score REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS business_criticality TEXT DEFAULT 'medium' CHECK (business_criticality IN ('critical', 'high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS data_domain TEXT, -- 'customer', 'finance', 'product', 'operations'
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Enhance the existing graph_nodes table with more metadata
ALTER TABLE code_insights.graph_nodes
ADD COLUMN IF NOT EXISTS fully_qualified_name TEXT, -- database.schema.table format
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS business_meaning TEXT,
ADD COLUMN IF NOT EXISTS data_lineage_metadata JSONB DEFAULT '{}';

-- Enhance the existing graph_edges table with confidence scoring
ALTER TABLE code_insights.graph_edges
ADD COLUMN IF NOT EXISTS confidence_score REAL DEFAULT 0.8 CHECK (confidence_score >= 0 AND confidence_score <= 1),
ADD COLUMN IF NOT EXISTS transformation_logic TEXT,
ADD COLUMN IF NOT EXISTS business_context TEXT,
ADD COLUMN IF NOT EXISTS discovered_at_line INTEGER;

-- 2. NEW SPECIALIZED LINEAGE TABLES

-- Data Assets Registry (extends graph_nodes with structured asset info)
CREATE TABLE IF NOT EXISTS code_insights.data_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES code_insights.graph_nodes(id) ON DELETE CASCADE,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('table', 'view', 'function', 'procedure', 'dataset', 'model', 'macro', 'source')),
    schema_name TEXT,
    database_name TEXT,
    full_qualified_name TEXT GENERATED ALWAYS AS (
        COALESCE(database_name || '.', '') || 
        COALESCE(schema_name || '.', '') || 
        asset_name
    ) STORED,
    asset_metadata JSONB DEFAULT '{}',
    file_id UUID REFERENCES code_insights.files(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(full_qualified_name, file_id)
);

-- Column-level tracking for detailed lineage
CREATE TABLE IF NOT EXISTS code_insights.data_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    column_type TEXT,
    is_nullable BOOLEAN DEFAULT TRUE,
    is_primary_key BOOLEAN DEFAULT FALSE,
    is_foreign_key BOOLEAN DEFAULT FALSE,
    foreign_key_reference TEXT,
    default_value TEXT,
    column_description TEXT,
    column_metadata JSONB DEFAULT '{}',
    ordinal_position INTEGER,
    business_meaning TEXT,
    pii_classification TEXT CHECK (pii_classification IN ('none', 'low', 'medium', 'high', 'sensitive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(asset_id, column_name)
);

-- Function registry for code dependencies
CREATE TABLE IF NOT EXISTS code_insights.code_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES code_insights.graph_nodes(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL,
    function_type TEXT NOT NULL CHECK (function_type IN ('function', 'procedure', 'macro', 'udf', 'method', 'class', 'module')),
    language TEXT NOT NULL,
    signature TEXT,
    return_type TEXT,
    function_body TEXT,
    parameters JSONB DEFAULT '[]',
    description TEXT,
    namespace TEXT,
    file_id UUID REFERENCES code_insights.files(id),
    line_start INTEGER,
    line_end INTEGER,
    complexity_score REAL DEFAULT 0,
    performance_notes TEXT,
    business_logic TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced lineage relationships (extends graph_edges)
CREATE TABLE IF NOT EXISTS code_insights.data_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_id UUID REFERENCES code_insights.graph_edges(id) ON DELETE CASCADE,
    source_asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id),
    target_asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id),
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('reads_from', 'writes_to', 'transforms', 'aggregates', 'joins', 'unions', 'filters')),
    operation_type TEXT CHECK (operation_type IN ('select', 'insert', 'update', 'delete', 'merge', 'create_table_as', 'create_view_as', 'truncate')),
    confidence_score REAL DEFAULT 0.8 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    transformation_logic TEXT,
    business_context TEXT,
    discovered_in_file_id UUID REFERENCES code_insights.files(id),
    discovered_at_line INTEGER,
    join_conditions JSONB DEFAULT '{}',
    filter_conditions JSONB DEFAULT '{}',
    aggregation_logic JSONB DEFAULT '{}',
    estimated_row_impact INTEGER,
    execution_frequency TEXT CHECK (execution_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'adhoc')),
    data_freshness_requirement TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(source_asset_id, target_asset_id, relationship_type, discovered_in_file_id)
);

-- Column-level lineage tracking
CREATE TABLE IF NOT EXISTS code_insights.column_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_column_id UUID NOT NULL REFERENCES code_insights.data_columns(id),
    target_column_id UUID NOT NULL REFERENCES code_insights.data_columns(id),
    transformation_type TEXT NOT NULL CHECK (transformation_type IN ('direct', 'calculated', 'aggregated', 'concatenated', 'cast', 'lookup', 'derived')),
    transformation_logic TEXT,
    confidence_score REAL DEFAULT 0.8 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    discovered_in_file_id UUID REFERENCES code_insights.files(id),
    discovered_at_line INTEGER,
    business_rule TEXT,
    calculation_formula TEXT,
    aggregation_function TEXT,
    grouping_columns JSONB DEFAULT '[]',
    filter_logic TEXT,
    quality_impact TEXT CHECK (quality_impact IN ('improves', 'maintains', 'degrades', 'unknown')),
    data_loss_risk TEXT CHECK (data_loss_risk IN ('none', 'low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File-level dependencies (supplements existing graph structure)
CREATE TABLE IF NOT EXISTS code_insights.file_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file_id UUID NOT NULL REFERENCES code_insights.files(id),
    target_file_id UUID NOT NULL REFERENCES code_insights.files(id),
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('imports', 'includes', 'references', 'executes', 'inherits')),
    import_statement TEXT,
    alias_used TEXT,
    specific_items JSONB DEFAULT '[]',
    confidence_score REAL DEFAULT 0.8 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    discovered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. IMPACT ANALYSIS TABLES

-- Change impact analysis
CREATE TABLE IF NOT EXISTS code_insights.impact_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    changed_asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id),
    impacted_asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id),
    impact_type TEXT NOT NULL CHECK (impact_type IN ('breaking', 'warning', 'info', 'performance')),
    impact_description TEXT,
    propagation_depth INTEGER DEFAULT 1,
    estimated_severity TEXT CHECK (estimated_severity IN ('critical', 'high', 'medium', 'low')),
    business_impact TEXT,
    mitigation_strategy TEXT,
    stakeholder_notification JSONB DEFAULT '[]',
    estimated_fix_effort TEXT CHECK (estimated_fix_effort IN ('trivial', 'minor', 'major', 'extensive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema change tracking
CREATE TABLE IF NOT EXISTS code_insights.schema_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('column_added', 'column_removed', 'column_renamed', 'type_changed', 'table_created', 'table_dropped', 'table_renamed', 'constraint_added', 'constraint_removed')),
    old_definition JSONB DEFAULT '{}',
    new_definition JSONB DEFAULT '{}',
    change_description TEXT,
    breaking_change BOOLEAN DEFAULT FALSE,
    backward_compatible BOOLEAN DEFAULT TRUE,
    migration_required BOOLEAN DEFAULT FALSE,
    rollback_strategy TEXT,
    discovered_in_file_id UUID REFERENCES code_insights.files(id),
    discovered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENHANCE EXISTING VECTOR STORAGE

-- Extend document_vectors with lineage-aware metadata
ALTER TABLE code_insights.document_vectors
ADD COLUMN IF NOT EXISTS section_type TEXT, -- 'asset_definition', 'transformation_logic', 'business_rule', 'dependency'
ADD COLUMN IF NOT EXISTS search_priority INTEGER DEFAULT 5 CHECK (search_priority >= 1 AND search_priority <= 10),
ADD COLUMN IF NOT EXISTS llm_context TEXT, -- Additional context for LLM consumption
ADD COLUMN IF NOT EXISTS estimated_line_start INTEGER,
ADD COLUMN IF NOT EXISTS estimated_line_end INTEGER,
ADD COLUMN IF NOT EXISTS complexity_score REAL DEFAULT 0;

-- Lineage-specific vector storage
CREATE TABLE IF NOT EXISTS code_insights.lineage_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lineage_id UUID REFERENCES code_insights.data_lineage(id),
    vector_type TEXT NOT NULL CHECK (vector_type IN ('transformation_logic', 'business_context', 'impact_analysis', 'join_logic', 'filter_logic')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    search_priority INTEGER DEFAULT 5 CHECK (search_priority >= 1 AND search_priority <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PERFORMANCE INDEXES

-- Enhanced indexes for lineage queries
CREATE INDEX IF NOT EXISTS idx_data_assets_qualified_name ON code_insights.data_assets(full_qualified_name);
CREATE INDEX IF NOT EXISTS idx_data_assets_type ON code_insights.data_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_data_assets_file ON code_insights.data_assets(file_id);

CREATE INDEX IF NOT EXISTS idx_data_lineage_source ON code_insights.data_lineage(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_target ON code_insights.data_lineage(target_asset_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_type ON code_insights.data_lineage(relationship_type);
CREATE INDEX IF NOT EXISTS idx_data_lineage_confidence ON code_insights.data_lineage(confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_column_lineage_source ON code_insights.column_lineage(source_column_id);
CREATE INDEX IF NOT EXISTS idx_column_lineage_target ON code_insights.column_lineage(target_column_id);
CREATE INDEX IF NOT EXISTS idx_column_lineage_transformation ON code_insights.column_lineage(transformation_type);

CREATE INDEX IF NOT EXISTS idx_data_columns_asset ON code_insights.data_columns(asset_id);
CREATE INDEX IF NOT EXISTS idx_code_functions_file ON code_insights.code_functions(file_id);
CREATE INDEX IF NOT EXISTS idx_code_functions_type ON code_insights.code_functions(function_type);

CREATE INDEX IF NOT EXISTS idx_file_dependencies_source ON code_insights.file_dependencies(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_dependencies_target ON code_insights.file_dependencies(target_file_id);

-- Vector search indexes
CREATE INDEX IF NOT EXISTS idx_lineage_vectors_embedding ON code_insights.lineage_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_lineage_vectors_type ON code_insights.lineage_vectors(vector_type);

-- Enhanced document vectors indexes
CREATE INDEX IF NOT EXISTS idx_document_vectors_section_type ON code_insights.document_vectors(section_type);
CREATE INDEX IF NOT EXISTS idx_document_vectors_priority ON code_insights.document_vectors(search_priority DESC);

-- 6. UTILITY FUNCTIONS

-- Function to calculate lineage confidence based on multiple factors
CREATE OR REPLACE FUNCTION code_insights.calculate_lineage_confidence(
    relationship_data JSONB,
    code_context TEXT,
    file_language TEXT,
    line_number INTEGER DEFAULT NULL
) RETURNS REAL AS $$
DECLARE
    base_confidence REAL := 0.5;
    language_bonus REAL := 0.0;
    context_bonus REAL := 0.0;
    explicit_bonus REAL := 0.0;
BEGIN
    -- Language-specific confidence adjustments
    CASE file_language
        WHEN 'sql' THEN language_bonus := 0.2;
        WHEN 'python' THEN language_bonus := 0.1;
        WHEN 'scala' THEN language_bonus := 0.15;
        ELSE language_bonus := 0.0;
    END CASE;
    
    -- Context clarity bonus
    IF code_context IS NOT NULL AND length(code_context) > 50 THEN
        context_bonus := 0.1;
    END IF;
    
    -- Explicit relationship indicators
    IF code_context ILIKE '%join%' OR code_context ILIKE '%from%' OR code_context ILIKE '%insert%' THEN
        explicit_bonus := 0.2;
    END IF;
    
    RETURN LEAST(1.0, base_confidence + language_bonus + context_bonus + explicit_bonus);
END;
$$ LANGUAGE plpgsql;

-- Enhanced search function that includes lineage context
CREATE OR REPLACE FUNCTION code_insights.search_vectors_with_lineage(
    query_embedding vector(1536),
    search_query TEXT DEFAULT '',
    match_threshold float DEFAULT 0.8,
    match_count int DEFAULT 10,
    filter_file_ids UUID[] DEFAULT NULL,
    filter_chunk_types TEXT[] DEFAULT NULL,
    filter_section_types TEXT[] DEFAULT NULL,
    min_priority INTEGER DEFAULT 1
)
RETURNS TABLE (
    id UUID,
    file_id UUID,
    chunk_id TEXT,
    chunk_type TEXT,
    section_type TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    search_priority INTEGER,
    file_path TEXT,
    repository_full_name TEXT,
    lineage_context JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dv.id,
        dv.file_id,
        dv.chunk_id,
        dv.chunk_type,
        dv.section_type,
        dv.content,
        dv.metadata,
        1 - (dv.embedding <=> query_embedding) as similarity,
        dv.search_priority,
        f.file_path,
        f.repository_full_name,
        jsonb_build_object(
            'complexity_score', f.complexity_score,
            'business_criticality', f.business_criticality,
            'data_domain', f.data_domain,
            'tags', f.tags
        ) as lineage_context
    FROM code_insights.document_vectors dv
    JOIN code_insights.files f ON dv.file_id = f.id
    WHERE 
        (1 - (dv.embedding <=> query_embedding)) > match_threshold
        AND (filter_file_ids IS NULL OR dv.file_id = ANY(filter_file_ids))
        AND (filter_chunk_types IS NULL OR dv.chunk_type = ANY(filter_chunk_types))
        AND (filter_section_types IS NULL OR dv.section_type = ANY(filter_section_types))
        AND (dv.search_priority >= min_priority)
        AND (search_query = '' OR (
            dv.content ILIKE '%' || search_query || '%' OR
            f.file_path ILIKE '%' || search_query || '%'
        ))
    ORDER BY 
        dv.search_priority DESC,
        dv.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 7. GRANT PERMISSIONS

-- Grant permissions on new tables
GRANT ALL PRIVILEGES ON code_insights.data_assets TO service_role;
GRANT ALL PRIVILEGES ON code_insights.data_columns TO service_role;
GRANT ALL PRIVILEGES ON code_insights.code_functions TO service_role;
GRANT ALL PRIVILEGES ON code_insights.data_lineage TO service_role;
GRANT ALL PRIVILEGES ON code_insights.column_lineage TO service_role;
GRANT ALL PRIVILEGES ON code_insights.file_dependencies TO service_role;
GRANT ALL PRIVILEGES ON code_insights.impact_analysis TO service_role;
GRANT ALL PRIVILEGES ON code_insights.schema_changes TO service_role;
GRANT ALL PRIVILEGES ON code_insights.lineage_vectors TO service_role;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION code_insights.calculate_lineage_confidence TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.search_vectors_with_lineage TO service_role;

-- 8. COMMENTS FOR DOCUMENTATION

COMMENT ON TABLE code_insights.data_assets IS 'Enhanced asset registry building on graph_nodes with structured metadata';
COMMENT ON TABLE code_insights.data_lineage IS 'Enhanced lineage relationships building on graph_edges with detailed context';
COMMENT ON TABLE code_insights.column_lineage IS 'Column-level lineage tracking for detailed transformation analysis';
COMMENT ON TABLE code_insights.impact_analysis IS 'Change impact analysis for risk assessment and stakeholder notification';
COMMENT ON FUNCTION code_insights.search_vectors_with_lineage IS 'Enhanced vector search with lineage context and priority filtering'; 