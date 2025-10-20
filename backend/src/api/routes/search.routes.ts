import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { HybridSearchController } from '../controllers/hybrid-search.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Apply auth middleware to all search routes
router.use(requireAuth);

/**
 * @route GET /api/search/hybrid
 * @desc Hybrid search - searches both metadata and files simultaneously
 * @query {
 *   q: string,
 *   metadata_limit?: number,
 *   files_limit?: number
 * }
 * @access Authenticated users
 */
router.get('/hybrid', HybridSearchController.hybridSearch);

/**
 * @route GET /api/search/files
 * @desc Search code files only
 * @query {
 *   q: string,
 *   file_type?: string,
 *   repository_name?: string,
 *   language?: string,
 *   limit?: number
 * }
 * @access Authenticated users
 */
router.get('/files', HybridSearchController.filesSearch);

/**
 * @route POST /api/search/semantic
 * @desc Perform semantic search across code documentation
 * @body {
 *   query: string,
 *   matchThreshold?: number,
 *   matchCount?: number,
 *   filterFileIds?: string[],
 *   filterChunkTypes?: string[],
 *   repositories?: string[]
 * }
 */
router.post('/semantic', SearchController.semanticSearch);

/**
 * @route POST /api/search/hybrid
 * @desc Perform hybrid search (semantic + keyword)
 * @body {
 *   query: string,
 *   semanticWeight?: number,
 *   keywordWeight?: number,
 *   matchCount?: number,
 *   filterFileIds?: string[],
 *   repositories?: string[]
 * }
 */
router.post('/hybrid', SearchController.hybridSearch);

/**
 * @route POST /api/search/entity
 * @desc Search for specific entities (tables, functions, etc.)
 * @body {
 *   entityType: 'table' | 'function' | 'column' | 'business_term',
 *   entityName: string,
 *   matchCount?: number,
 *   repositories?: string[]
 * }
 */
router.post('/entity', SearchController.entitySearch);

/**
 * @route GET /api/search/suggestions
 * @desc Get search suggestions based on partial query
 * @query {
 *   query: string,
 *   limit?: number
 * }
 */
router.get('/suggestions', SearchController.searchSuggestions);

/**
 * @route GET /api/search/analytics
 * @desc Get search analytics (admin/insights)
 * @query {
 *   timeRange?: '1d' | '7d' | '30d',
 *   userId?: string
 * }
 */
router.get('/analytics', SearchController.searchAnalytics);

/**
 * @route GET /api/search/metadata
 * @desc Fast metadata search using Tantivy (tables, views, columns, models)
 * @query {
 *   query: string,
 *   object_type?: string,
 *   limit?: number
 * }
 * @access Authenticated users
 */
router.get('/metadata', HybridSearchController.metadataSearch);

/**
 * @route POST /api/search/rebuild-index
 * @desc Admin: Manually rebuild search index for organization
 * @access Admin/Owner only
 */
router.post('/rebuild-index', SearchController.rebuildSearchIndex);

export default router; 