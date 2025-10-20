/**
 * Hybrid Search Controller
 * Searches both metadata (tables, columns) and files (code) simultaneously
 */

import { Request, Response } from 'express';
import { TantivySearchService } from '../../services/TantivySearchService';
import { FileIndexingService } from '../../services/FileIndexingService';

export class HybridSearchController {
  /**
   * Hybrid search - searches both metadata and files
   * GET /api/search/hybrid?q=customer&limit=20
   */
  static async hybridSearch(req: Request, res: Response) {
    try {
      const { 
        q: query,
        metadata_limit = 10,
        files_limit = 10
      } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }

      // Get user's organization from auth
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Organization not found in user context'
        });
      }

      // Get auth token
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization required'
        });
      }

      const token = authHeader.replace('Bearer ', '');

      console.log(`🔍 Hybrid search request: "${query}" for org: ${organizationId}`);

      // Search both indexes in parallel
      const [metadataResults, fileResults] = await Promise.allSettled([
        // Search metadata (tables, columns, views)
        TantivySearchService.getInstance().search(
          organizationId,
          query as string,
          token,
          { limit: Number(metadata_limit) }
        ),
        // Search files (code, docs)
        FileIndexingService.getInstance().searchFiles(
          organizationId,
          query as string,
          { limit: Number(files_limit) }
        )
      ]);

      // Process metadata results
      const metadata = metadataResults.status === 'fulfilled'
        ? metadataResults.value
        : { results: [], total: 0, error: metadataResults.reason?.message };

      // Process file results
      const files = fileResults.status === 'fulfilled'
        ? fileResults.value
        : { results: [], total: 0, error: fileResults.reason?.message };

      // Calculate combined stats
      const totalResults = (metadata.results?.length || 0) + (files.results?.length || 0);
      
      console.log(`   ✅ Found ${metadata.results?.length || 0} metadata + ${files.results?.length || 0} file results`);

      return res.json({
        success: true,
        query: query,
        results: {
          metadata: {
            items: metadata.results || [],
            total: metadata.total || 0,
            error: metadata.error
          },
          files: {
            items: files.results || [],
            total: files.total || 0,
            error: files.error
          },
          combined: {
            total: totalResults,
            metadata_count: metadata.results?.length || 0,
            files_count: files.results?.length || 0
          }
        }
      });

    } catch (error) {
      console.error('Error in hybrid search:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during hybrid search',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Search metadata only (backward compatibility)
   */
  static async metadataSearch(req: Request, res: Response) {
    try {
      const { query, object_type, limit = 20 } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }

      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization required'
        });
      }

      const token = authHeader.replace('Bearer ', '');

      const tantivyService = TantivySearchService.getInstance();
      const results = await tantivyService.search(
        organizationId,
        query,
        token,
        {
          object_type: object_type as string,
          limit: Number(limit)
        }
      );

      return res.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('Error in metadata search:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Search files only
   */
  static async filesSearch(req: Request, res: Response) {
    try {
      const { 
        q: query,
        file_type,
        repository_name,
        language,
        limit = 20
      } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }

      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const fileIndexingService = FileIndexingService.getInstance();
      const results = await fileIndexingService.searchFiles(
        organizationId,
        query,
        {
          fileType: file_type as string,
          repositoryName: repository_name as string,
          language: language as string,
          limit: Number(limit)
        }
      );

      return res.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('Error in files search:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
