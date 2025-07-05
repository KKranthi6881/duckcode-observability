-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS code_insights.get_repository_processing_status(TEXT, UUID);

-- Enhanced processing status function for all 5 phases
CREATE OR REPLACE FUNCTION code_insights.get_repository_processing_status(
    repo_full_name TEXT,
    user_id_param UUID
)
RETURNS TABLE (
    total_files BIGINT,
    -- Phase 1: Documentation
    documentation_completed BIGINT,
    documentation_failed BIGINT,
    documentation_pending BIGINT,
    -- Phase 2: Vectors
    vector_completed BIGINT,
    vector_failed BIGINT,
    vector_pending BIGINT,
    -- Phase 3: Lineage
    lineage_completed BIGINT,
    lineage_failed BIGINT,
    lineage_pending BIGINT,
    -- Overall progress
    overall_completed BIGINT,
    overall_progress NUMERIC,
    -- Phase progress percentages
    phase_1_progress NUMERIC,
    phase_2_progress NUMERIC,
    phase_3_progress NUMERIC,
    phase_4_completed BOOLEAN,
    phase_5_completed BOOLEAN,
    file_details JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH file_stats AS (
        SELECT 
            f.id,
            f.file_path,
            f.parsing_status,
            COALESCE(pj.status, 'pending') as doc_status,
            COALESCE(pj.vector_status, 'pending') as vec_status,
            COALESCE(pj.lineage_status, 'pending') as lineage_status,
            pj.error_details,
            pj.vector_error_details,
            pj.vector_chunks_count,
            -- Consider overall status: all phases must be completed for SQL files
            CASE 
                WHEN f.language ILIKE '%sql%' OR f.file_path ILIKE '%.sql' THEN
                    CASE 
                        WHEN COALESCE(pj.status, 'pending') = 'completed' 
                             AND COALESCE(pj.vector_status, 'pending') = 'completed'
                             AND COALESCE(pj.lineage_status, 'pending') = 'completed' THEN 'completed'
                        WHEN COALESCE(pj.status, 'pending') = 'failed' 
                             OR COALESCE(pj.vector_status, 'pending') = 'failed'
                             OR COALESCE(pj.lineage_status, 'pending') = 'failed' THEN 'failed'
                        ELSE 'pending'
                    END
                ELSE
                    CASE 
                        WHEN COALESCE(pj.status, 'pending') = 'completed' 
                             AND COALESCE(pj.vector_status, 'pending') = 'completed' THEN 'completed'
                        WHEN COALESCE(pj.status, 'pending') = 'failed' 
                             OR COALESCE(pj.vector_status, 'pending') = 'failed' THEN 'failed'
                        ELSE 'pending'
                    END
            END as overall_status
        FROM code_insights.files f
        LEFT JOIN code_insights.processing_jobs pj ON f.id = pj.file_id
        WHERE f.repository_full_name = repo_full_name 
        AND f.user_id = user_id_param
    ),
    aggregated_stats AS (
        SELECT 
            COUNT(*) as total_files,
            -- Phase 1: Documentation
            COUNT(*) FILTER (WHERE doc_status = 'completed') as documentation_completed,
            COUNT(*) FILTER (WHERE doc_status = 'failed') as documentation_failed,
            COUNT(*) FILTER (WHERE doc_status = 'pending' OR doc_status = 'processing') as documentation_pending,
            -- Phase 2: Vectors
            COUNT(*) FILTER (WHERE vec_status = 'completed') as vector_completed,
            COUNT(*) FILTER (WHERE vec_status = 'failed') as vector_failed,
            COUNT(*) FILTER (WHERE vec_status = 'pending' OR vec_status = 'processing') as vector_pending,
            -- Phase 3: Lineage
            COUNT(*) FILTER (WHERE lineage_status = 'completed') as lineage_completed,
            COUNT(*) FILTER (WHERE lineage_status = 'failed') as lineage_failed,
            COUNT(*) FILTER (WHERE lineage_status = 'pending' OR lineage_status = 'processing') as lineage_pending,
            -- Overall
            COUNT(*) FILTER (WHERE overall_status = 'completed') as overall_completed,
            jsonb_agg(
                jsonb_build_object(
                    'filePath', file_path,
                    'docStatus', doc_status,
                    'vectorStatus', vec_status,
                    'lineageStatus', lineage_status,
                    'overallStatus', overall_status,
                    'docError', error_details,
                    'vectorError', vector_error_details,
                    'vectorChunks', vector_chunks_count
                ) ORDER BY file_path
            ) as file_details
        FROM file_stats
    ),
    phase_status AS (
        SELECT 
            -- Check if Phase 4 (Dependencies) is completed
            EXISTS(
                SELECT 1 FROM code_insights.repository_dependency_analysis 
                WHERE repository_full_name = repo_full_name 
                AND user_id = user_id_param
                AND analysis_type = 'cross_file_dependencies'
            ) as phase_4_completed,
            -- Check if Phase 5 (Impact Analysis) is completed
            EXISTS(
                SELECT 1 FROM code_insights.repository_impact_analysis 
                WHERE repository_full_name = repo_full_name 
                AND user_id = user_id_param
            ) as phase_5_completed
    )
    SELECT 
        s.total_files,
        s.documentation_completed,
        s.documentation_failed,
        s.documentation_pending,
        s.vector_completed,
        s.vector_failed,
        s.vector_pending,
        s.lineage_completed,
        s.lineage_failed,
        s.lineage_pending,
        s.overall_completed,
        CASE 
            WHEN s.total_files > 0 THEN ROUND((s.overall_completed::NUMERIC / s.total_files::NUMERIC) * 100, 2)
            ELSE 0
        END as overall_progress,
        -- Phase progress percentages
        CASE 
            WHEN s.total_files > 0 THEN ROUND((s.documentation_completed::NUMERIC / s.total_files::NUMERIC) * 100, 2)
            ELSE 0
        END as phase_1_progress,
        CASE 
            WHEN s.total_files > 0 THEN ROUND((s.vector_completed::NUMERIC / s.total_files::NUMERIC) * 100, 2)
            ELSE 0
        END as phase_2_progress,
        CASE 
            WHEN s.total_files > 0 THEN ROUND((s.lineage_completed::NUMERIC / s.total_files::NUMERIC) * 100, 2)
            ELSE 0
        END as phase_3_progress,
        ps.phase_4_completed,
        ps.phase_5_completed,
        s.file_details
    FROM aggregated_stats s
    CROSS JOIN phase_status ps;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION code_insights.get_repository_processing_status TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.get_repository_processing_status TO authenticated; 