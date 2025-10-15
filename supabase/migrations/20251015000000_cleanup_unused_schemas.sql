-- =====================================================
-- CLEANUP: Remove Unused code_insights Schema
-- =====================================================
-- This schema was used for LLM-based code analysis but is being replaced
-- with SQLglot-based metadata extraction in Phase 3.
-- 
-- Removes:
-- - code_insights.files
-- - code_insights.processing_jobs
-- - code_insights.code_summaries
-- - code_insights.graph_nodes
-- - code_insights.graph_edges
-- - code_insights.document_vectors
-- - code_insights.search_queries
--
-- Created: 2025-01-15
-- =====================================================

BEGIN;

-- Drop all code_insights tables and the schema
DROP SCHEMA IF EXISTS code_insights CASCADE;

-- Log cleanup
DO $$
BEGIN
  RAISE NOTICE 'Cleaned up code_insights schema - will be replaced with metadata schema in Phase 3';
END $$;

COMMIT;
