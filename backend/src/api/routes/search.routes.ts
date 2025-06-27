import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';

const router = Router();

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

export default router; 