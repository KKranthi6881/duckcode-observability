-- Enhance document_vectors table with additional metadata for advanced code intelligence
-- This migration adds columns to support better dependency tracking and LLM context

-- Add new columns for enhanced metadata
ALTER TABLE code_insights.document_vectors 
ADD COLUMN IF NOT EXISTS section_type TEXT,
ADD COLUMN IF NOT EXISTS search_priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS llm_context TEXT,
ADD COLUMN IF NOT EXISTS estimated_line_start INTEGER,
ADD COLUMN IF NOT EXISTS estimated_line_end INTEGER,
ADD COLUMN IF NOT EXISTS complexity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS repository_name TEXT,
ADD COLUMN IF NOT EXISTS language TEXT;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_vectors_section_type ON code_insights.document_vectors(section_type);
CREATE INDEX IF NOT EXISTS idx_vectors_search_priority ON code_insights.document_vectors(search_priority);
CREATE INDEX IF NOT EXISTS idx_vectors_llm_context ON code_insights.document_vectors(llm_context);
CREATE INDEX IF NOT EXISTS idx_vectors_repository ON code_insights.document_vectors(repository_name);
CREATE INDEX IF NOT EXISTS idx_vectors_language ON code_insights.document_vectors(language);
CREATE INDEX IF NOT EXISTS idx_vectors_complexity ON code_insights.document_vectors(complexity_score);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_vectors_repo_priority ON code_insights.document_vectors(repository_name, search_priority);
CREATE INDEX IF NOT EXISTS idx_vectors_lang_context ON code_insights.document_vectors(language, llm_context);

-- Add comments explaining the new columns
COMMENT ON COLUMN code_insights.document_vectors.section_type IS 'Type of code section: overview, business_rules, code_implementation, architecture, process, optimization, guidelines, relationships';
COMMENT ON COLUMN code_insights.document_vectors.search_priority IS 'Search priority for LLM: very_high, high, medium, low - used to rank results';
COMMENT ON COLUMN code_insights.document_vectors.llm_context IS 'Context category for LLM understanding: file_overview, business_intelligence, code_analysis, technical_architecture, etc.';
COMMENT ON COLUMN code_insights.document_vectors.estimated_line_start IS 'Estimated starting line number in the original file (for code blocks)';
COMMENT ON COLUMN code_insights.document_vectors.estimated_line_end IS 'Estimated ending line number in the original file (for code blocks)';
COMMENT ON COLUMN code_insights.document_vectors.complexity_score IS 'Computed complexity score for code sections (0-100+)';
COMMENT ON COLUMN code_insights.document_vectors.repository_name IS 'Full repository name for cross-repo analysis';
COMMENT ON COLUMN code_insights.document_vectors.language IS 'Programming/markup language of the source file';

-- Create a view for simplified vector search with enhanced metadata
CREATE OR REPLACE VIEW code_insights.enhanced_vector_search AS
SELECT 
    dv.id,
    dv.file_id,
    f.file_path,
    dv.chunk_id,
    dv.chunk_type,
    dv.section_type,
    dv.search_priority,
    dv.llm_context,
    dv.content,
    dv.metadata,
    dv.estimated_line_start,
    dv.estimated_line_end,
    dv.complexity_score,
    dv.repository_name,
    dv.language,
    dv.token_count,
    dv.created_at,
    
    -- Extract key metadata for easier querying
    (dv.metadata->>'function_names')::text[] as function_names,
    (dv.metadata->>'table_names')::text[] as table_names,
    (dv.metadata->>'column_names')::text[] as column_names,
    (dv.metadata->'dependencies'->>'tables')::jsonb as table_dependencies,
    (dv.metadata->'dependencies'->>'functions')::jsonb as function_dependencies,
    (dv.metadata->>'code_patterns')::text[] as code_patterns,
    (dv.metadata->'complexity_indicators'->>'factors')::text[] as complexity_factors,
    
    -- Computed fields for better search
    CASE 
        WHEN dv.search_priority = 'very_high' THEN 4
        WHEN dv.search_priority = 'high' THEN 3  
        WHEN dv.search_priority = 'medium' THEN 2
        ELSE 1
    END as priority_weight,
    
    -- Full text search vector
    to_tsvector('english', 
        COALESCE(dv.content, '') || ' ' || 
        COALESCE(dv.metadata->>'section_name', '') || ' ' ||
        COALESCE(dv.metadata->>'function_names', '') || ' ' ||
        COALESCE(dv.metadata->>'table_names', '')
    ) as search_vector

FROM code_insights.document_vectors dv
JOIN code_insights.files f ON dv.file_id = f.id;

-- Grant access to the view
GRANT SELECT ON code_insights.enhanced_vector_search TO service_role;

-- Create a full-text search index on the view
CREATE INDEX IF NOT EXISTS idx_enhanced_vector_search_fts 
ON code_insights.document_vectors 
USING gin(to_tsvector('english', 
    COALESCE(content, '') || ' ' || 
    COALESCE(metadata->>'section_name', '') || ' ' ||
    COALESCE(metadata->>'function_names', '') || ' ' ||
    COALESCE(metadata->>'table_names', '')
));

-- Function to search vectors with enhanced filtering
CREATE OR REPLACE FUNCTION code_insights.search_vectors(
    query_text TEXT,
    repo_name TEXT DEFAULT NULL,
    language_filter TEXT DEFAULT NULL,
    context_filter TEXT DEFAULT NULL,
    min_priority TEXT DEFAULT 'medium',
    limit_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    file_path TEXT,
    chunk_id TEXT,
    section_type TEXT,
    content TEXT,
    relevance_score REAL,
    metadata JSONB,
    line_range TEXT,
    complexity_score INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        evs.file_path,
        evs.chunk_id,
        evs.section_type,
        evs.content,
        ts_rank(evs.search_vector, plainto_tsquery('english', query_text)) as relevance_score,
        evs.metadata,
        CASE 
            WHEN evs.estimated_line_start IS NOT NULL AND evs.estimated_line_end IS NOT NULL 
            THEN evs.estimated_line_start::text || '-' || evs.estimated_line_end::text
            ELSE NULL
        END as line_range,
        evs.complexity_score
    FROM code_insights.enhanced_vector_search evs
    WHERE 
        evs.search_vector @@ plainto_tsquery('english', query_text)
        AND (repo_name IS NULL OR evs.repository_name = repo_name)
        AND (language_filter IS NULL OR evs.language = language_filter)
        AND (context_filter IS NULL OR evs.llm_context = context_filter)
        AND evs.priority_weight >= CASE 
            WHEN min_priority = 'very_high' THEN 4
            WHEN min_priority = 'high' THEN 3
            WHEN min_priority = 'medium' THEN 2
            ELSE 1
        END
    ORDER BY 
        relevance_score DESC,
        evs.priority_weight DESC,
        evs.complexity_score DESC
    LIMIT limit_results;
END;
$$;

-- Grant execute on the search function
GRANT EXECUTE ON FUNCTION code_insights.search_vectors TO service_role; 