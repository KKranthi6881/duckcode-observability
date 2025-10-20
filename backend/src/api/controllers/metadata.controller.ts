import { Request, Response } from 'express';
import { ExtractionOrchestrator } from '../../services/metadata/extraction/ExtractionOrchestrator';
import { supabase, supabaseCodeInsights } from '../../config/supabase';

export class MetadataController {
  private orchestrator: ExtractionOrchestrator;

  constructor(orchestrator?: ExtractionOrchestrator) {
    this.orchestrator = orchestrator || new ExtractionOrchestrator();

    // Setup progress listeners
    this.orchestrator.on('progress', (progress) => {
      console.log(`📊 Extraction progress: ${progress.progress}% - ${progress.message}`);
    });

    this.orchestrator.on('extraction-complete', (result) => {
      console.log(`✅ Extraction completed for ${result.connectionId}`);
    });

    this.orchestrator.on('extraction-failed', (result) => {
      console.error(`❌ Extraction failed for ${result.connectionId}:`, result.errors);
    });
  }

  /**
   * Trigger automatic extraction for a connection
   * POST /api/metadata/connections/:id/extract
   */
  async triggerExtraction(req: Request, res: Response) {
    try {
      const { id: connectionId } = req.params;

      console.log(`🚀 Triggering extraction for connection: ${connectionId}`);

      // Verify connection exists (in enterprise schema)
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found'
        });
      }

      // Check if extraction is already running
      const existingProgress = this.orchestrator.getProgress(connectionId);
      if (existingProgress) {
        return res.status(409).json({
          success: false,
          error: 'Extraction already in progress',
          progress: existingProgress
        });
      }

      // Start extraction asynchronously
      this.orchestrator.startExtraction(connectionId)
        .catch((error) => {
          console.error(`Background extraction failed:`, error);
        });

      // Return immediately with queued status
      return res.status(202).json({
        success: true,
        message: 'Extraction started',
        connectionId,
        status: 'extracting'
      });

    } catch (error: any) {
      console.error('❌ Error triggering extraction:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get extraction progress
   * GET /api/metadata/connections/:id/progress
   */
  async getProgress(req: Request, res: Response) {
    try {
      const { id: connectionId } = req.params;

      const progress = this.orchestrator.getProgress(connectionId);

      if (!progress) {
        // Check connection status in database
        const { data: connection } = await supabase
          .schema('enterprise')
          .from('github_connections')
          .select('status, manifest_uploaded, total_objects')
          .eq('id', connectionId)
          .single();

        if (connection) {
          return res.json({
            connectionId,
            phase: connection.manifest_uploaded ? 'completed' : 'not_started',
            progress: connection.manifest_uploaded ? 100 : 0,
            message: connection.manifest_uploaded ? 'Extraction completed' : 'Not started',
            status: connection.status
          });
        }

        return res.status(404).json({
          success: false,
          error: 'Connection not found'
        });
      }

      return res.json(progress);

    } catch (error: any) {
      console.error('Error getting progress:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all active extractions
   * GET /api/metadata/extractions/active
   */
  async getActiveExtractions(req: Request, res: Response) {
    try {
      const active = this.orchestrator.getActiveExtractions();

      return res.json({
        count: active.length,
        extractions: active
      });

    } catch (error: any) {
      console.error('Error getting active extractions:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel an active extraction
   * POST /api/metadata/connections/:id/cancel
   */
  async cancelExtraction(req: Request, res: Response) {
    try {
      const { id: connectionId } = req.params;

      console.log(`🛑 Request to cancel extraction for connection: ${connectionId}`);

      const cancelled = await this.orchestrator.cancelExtraction(connectionId);

      if (cancelled) {
        return res.json({
          success: true,
          message: 'Extraction cancelled',
          connectionId
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'No active extraction found for this connection'
        });
      }

    } catch (error: any) {
      console.error('❌ Error cancelling extraction:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get lineage for a connection
   * GET /api/metadata/connections/:id/lineage
   */
  async getLineage(req: Request, res: Response) {
    try {
      const { id: connectionId } = req.params;
      const { object_name, include_column_lineage = false } = req.query;

      // Get objects
      let objectsQuery = supabase
        .from('objects')
        .select('*, columns(*)')
        .eq('connection_id', connectionId);

      if (object_name) {
        objectsQuery = objectsQuery.eq('name', object_name);
      }

      const { data: objects } = await objectsQuery;

      // Get dependencies
      const objectIds = objects?.map(o => o.id) || [];
      const { data: dependencies } = await supabase
        .from('dependencies')
        .select('*')
        .in('source_object_id', objectIds);

      let columnLineage = [];
      if (include_column_lineage) {
        const { data: lineage } = await supabase
          .from('columns_lineage')
          .select('*')
          .in('source_object_id', objectIds);
        
        columnLineage = lineage || [];
      }

      return res.json({
        objects: objects || [],
        dependencies: dependencies || [],
        column_lineage: columnLineage
      });

    } catch (error: any) {
      console.error('Error getting lineage:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get extraction statistics
   * GET /api/metadata/connections/:id/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      const { id: connectionId } = req.params;

      const { data: stats } = await supabase.rpc('get_extraction_stats', {
        p_connection_id: connectionId
      });

      return res.json({
        success: true,
        stats: stats || []
      });

    } catch (error: any) {
      console.error('Error getting stats:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
