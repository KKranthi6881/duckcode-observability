import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

/**
 * Repository Controller
 * Provides access to admin-connected repositories for all organization users
 * (Admins + Members can view repositories connected by admin)
 */
export class RepositoryController {
  
  /**
   * Get all repositories for the user's organization
   * Available to all authenticated users in the organization
   */
  static async listRepositories(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const organizationId = user?.organization_id;
      
      console.log('[RepositoryController] User:', user?.id);
      console.log('[RepositoryController] Organization ID:', organizationId);
      
      if (!organizationId) {
        console.error('[RepositoryController] Missing organization ID for user:', user?.id);
        return res.status(400).json({ error: 'Organization ID required' });
      }

      // Fetch all GitHub connections for the organization
      const { data: connections, error } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(connections || []);
    } catch (error: any) {
      console.error('Error fetching repositories:', error);
      res.status(500).json({ 
        error: 'Failed to fetch repositories',
        message: error.message 
      });
    }
  }

  /**
   * Get statistics for a specific repository
   */
  static async getRepositoryStats(req: Request, res: Response) {
    try {
      const { repositoryId } = req.params;
      const user = (req as any).user;
      const organizationId = user?.organization_id;

      // Verify repository belongs to user's organization
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('id', repositoryId)
        .eq('organization_id', organizationId)
        .single();

      if (connError || !connection) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      // Get object count
      const { count: objectCount } = await supabase
        .schema('metadata')
        .from('objects')
        .select('*', { count: 'exact', head: true })
        .eq('connection_id', repositoryId);

      // Get column count
      const { data: objects } = await supabase
        .schema('metadata')
        .from('objects')
        .select('id')
        .eq('connection_id', repositoryId);

      const objectIds = objects?.map(o => o.id) || [];
      let columnCount = 0;
      
      if (objectIds.length > 0) {
        const { count } = await supabase
          .schema('metadata')
          .from('columns')
          .select('*', { count: 'exact', head: true })
          .in('object_id', objectIds);
        columnCount = count || 0;
      }

      // Get dependency count
      const { count: dependencyCount } = await supabase
        .schema('metadata')
        .from('dependencies')
        .select('*', { count: 'exact', head: true })
        .in('source_object_id', objectIds);

      res.json({
        id: connection.id,
        name: connection.repository_name,
        fullName: `${connection.repository_owner}/${connection.repository_name}`,
        language: 'dbt', // Could be enhanced to detect from files
        lastProcessed: connection.last_extraction_at,
        status: connection.status,
        stats: {
          files: connection.total_files || 0,
          documentation: objectCount || 0,
          vectors: objectCount || 0,
          lineage: columnCount,
          dependencies: dependencyCount || 0
        }
      });
    } catch (error: any) {
      console.error('Error fetching repository stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch repository stats',
        message: error.message 
      });
    }
  }

  /**
   * Get metadata objects for a repository
   */
  static async getRepositoryMetadata(req: Request, res: Response) {
    try {
      const { repositoryId } = req.params;
      const user = (req as any).user;
      const organizationId = user?.organization_id;

      // Verify repository belongs to user's organization
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('id')
        .eq('id', repositoryId)
        .eq('organization_id', organizationId)
        .single();

      if (connError || !connection) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      // Get all metadata objects for this repository
      const { data: objects, error } = await supabase
        .schema('metadata')
        .from('objects')
        .select('*')
        .eq('connection_id', repositoryId)
        .order('name', { ascending: true });

      if (error) throw error;

      res.json(objects || []);
    } catch (error: any) {
      console.error('Error fetching repository metadata:', error);
      res.status(500).json({ 
        error: 'Failed to fetch repository metadata',
        message: error.message 
      });
    }
  }
}
