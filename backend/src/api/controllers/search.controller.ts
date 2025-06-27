import { Request, Response } from 'express';
import { vectorService } from '../../services/vector.service';

export class SearchController {
  /**
   * Perform semantic search across code documentation
   */
  static async semanticSearch(req: Request, res: Response) {
    try {
      const { 
        query, 
        matchThreshold = 0.7, 
        matchCount = 10,
        filterFileIds,
        filterChunkTypes,
        repositories 
      } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required and must be a non-empty string'
        });
      }

      // Get user ID from session/auth
      const userId = req.user?.id;

      // Filter by repositories if provided
      let fileIds = filterFileIds;
      if (repositories && repositories.length > 0) {
        fileIds = await SearchController.getFileIdsByRepositories(repositories);
      }

      const results = await vectorService.semanticSearch(query, {
        matchThreshold: Number(matchThreshold),
        matchCount: Number(matchCount),
        filterFileIds: fileIds,
        filterChunkTypes,
        userId
      });

      return res.json({
        success: true,
        data: {
          query,
          results,
          count: results.length,
          searchType: 'semantic',
          filters: {
            matchThreshold,
            matchCount,
            repositories,
            chunkTypes: filterChunkTypes
          }
        }
      });

    } catch (error) {
      console.error('Error in semantic search:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during semantic search',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Perform hybrid search (semantic + keyword)
   */
  static async hybridSearch(req: Request, res: Response) {
    try {
      const { 
        query, 
        semanticWeight = 0.7,
        keywordWeight = 0.3,
        matchCount = 10,
        filterFileIds,
        repositories 
      } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required and must be a non-empty string'
        });
      }

      const userId = req.user?.id;

      // Filter by repositories if provided
      let fileIds = filterFileIds;
      if (repositories && repositories.length > 0) {
        fileIds = await SearchController.getFileIdsByRepositories(repositories);
      }

      const results = await vectorService.hybridSearch(query, {
        semanticWeight: Number(semanticWeight),
        keywordWeight: Number(keywordWeight),
        matchCount: Number(matchCount),
        filterFileIds: fileIds,
        userId
      });

      return res.json({
        success: true,
        data: {
          query,
          results,
          count: results.length,
          searchType: 'hybrid',
          filters: {
            semanticWeight,
            keywordWeight,
            matchCount,
            repositories
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
   * Search for specific entities (tables, functions, etc.)
   */
  static async entitySearch(req: Request, res: Response) {
    try {
      const { 
        entityType, // 'table', 'function', 'column', 'business_term'
        entityName,
        matchCount = 10,
        repositories 
      } = req.body;

      if (!entityType || !entityName) {
        return res.status(400).json({
          success: false,
          message: 'entityType and entityName are required'
        });
      }

      const userId = req.user?.id;

      // Filter by repositories if provided
      let fileIds;
      if (repositories && repositories.length > 0) {
        fileIds = await SearchController.getFileIdsByRepositories(repositories);
      }

      // Build search query based on entity type
      let searchQuery = '';
      let filterChunkTypes: string[] = [];

      switch (entityType) {
        case 'table':
          searchQuery = `table ${entityName} database schema`;
          filterChunkTypes = ['code_block', 'technical_details'];
          break;
        case 'function':
          searchQuery = `function ${entityName} method implementation`;
          filterChunkTypes = ['code_block', 'technical_details'];
          break;
        case 'column':
          searchQuery = `column ${entityName} field attribute`;
          filterChunkTypes = ['code_block', 'technical_details'];
          break;
        case 'business_term':
          searchQuery = `business logic ${entityName} requirement`;
          filterChunkTypes = ['business_logic', 'summary'];
          break;
        default:
          searchQuery = entityName;
      }

      const results = await vectorService.semanticSearch(searchQuery, {
        matchThreshold: 0.6, // Lower threshold for entity search
        matchCount: Number(matchCount),
        filterFileIds: fileIds,
        filterChunkTypes,
        userId
      });

      return res.json({
        success: true,
        data: {
          entityType,
          entityName,
          searchQuery,
          results,
          count: results.length,
          searchType: 'entity',
          filters: {
            chunkTypes: filterChunkTypes,
            repositories
          }
        }
      });

    } catch (error) {
      console.error('Error in entity search:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during entity search',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  static async searchSuggestions(req: Request, res: Response) {
    try {
      const { query, limit = 5 } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.json({
          success: true,
          data: { suggestions: [] }
        });
      }

      // This is a simple implementation - could be enhanced with more sophisticated suggestion logic
      const suggestions = await SearchController.generateSuggestions(query as string, Number(limit));

      return res.json({
        success: true,
        data: { suggestions }
      });

    } catch (error) {
      console.error('Error generating search suggestions:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error generating suggestions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get search analytics for admin/insights
   */
  static async searchAnalytics(req: Request, res: Response) {
    try {
      const { timeRange = '7d', userId } = req.query;

      // This would typically require admin permissions
      if (!req.user?.isAdmin && userId && userId !== req.user?.id) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const analytics = await SearchController.getSearchAnalytics(timeRange as string, userId as string);

      return res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error fetching search analytics:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error fetching analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper methods
  private static async getFileIdsByRepositories(repositories: string[]): Promise<string[]> {
    try {
      const { supabase } = vectorService as any;
      const { data, error } = await supabase
        .from('code_insights.files')
        .select('id')
        .in('repository_full_name', repositories);

      if (error) {
        console.error('Error fetching file IDs by repositories:', error);
        return [];
      }

      return (data || []).map((file: any) => file.id);
    } catch (error) {
      console.error('Error in getFileIdsByRepositories:', error);
      return [];
    }
  }

  private static async generateSuggestions(query: string, limit: number): Promise<string[]> {
    // Simple suggestion implementation
    // In a real implementation, you might:
    // 1. Look up common search terms from analytics
    // 2. Extract entity names from metadata
    // 3. Use autocomplete based on indexed content

    const commonTerms = [
      'business logic',
      'data transformation',
      'API endpoint',
      'database query',
      'function implementation',
      'table schema',
      'error handling',
      'authentication',
      'validation',
      'configuration'
    ];

    const suggestions = commonTerms
      .filter(term => term.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);

    return suggestions;
  }

  private static async getSearchAnalytics(timeRange: string, userId?: string): Promise<any> {
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // This would query the search_queries table for analytics
    // Implementation depends on your specific analytics needs
    return {
      timeRange,
      totalQueries: 0,
      uniqueUsers: 0,
      avgResponseTime: 0,
      topQueries: [],
      searchTypes: {
        semantic: 0,
        hybrid: 0,
        entity: 0
      }
    };
  }
} 