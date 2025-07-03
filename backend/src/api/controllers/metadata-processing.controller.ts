import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

interface ProcessingPhase {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  details?: any;
}

export class MetadataProcessingController {
  
  /**
   * Start comprehensive metadata processing pipeline
   * Orchestrates all phases: Discovery → Documentation → Vectors → Lineage → Dependencies → Analysis
   */
  static async startProcessingPipeline(req: Request, res: Response) {
    try {
      const { repositoryId, phases = ['all'] } = req.body;
      
      console.log(`🚀 Starting comprehensive metadata processing for repository: ${repositoryId}`);
      
      const processingJob = {
        repository_id: repositoryId,
        job_type: 'comprehensive_metadata',
        status: 'processing',
        phases: phases,
        started_at: new Date().toISOString()
      };

      // Create processing job record
      const { data: jobData, error: jobError } = await supabase
        .from('processing_jobs')
        .insert(processingJob)
        .select()
        .single();

      if (jobError) {
        console.error('Error creating processing job:', jobError);
        return res.status(500).json({ error: 'Failed to create processing job' });
      }

      // Start the processing pipeline (async)
      MetadataProcessingController.executeProcessingPipeline(jobData.id, repositoryId, phases);

      res.json({
        message: 'Metadata processing pipeline started',
        jobId: jobData.id,
        phases: [
          'File Discovery',
          'Documentation Analysis', 
          'Vector Generation',
          'Lineage Extraction',
          'Dependency Resolution',
          'Impact Analysis'
        ]
      });

    } catch (error) {
      console.error('Error starting processing pipeline:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute the complete processing pipeline
   */
  static async executeProcessingPipeline(jobId: string, repositoryId: string, phases: string[]) {
    const processingPhases: ProcessingPhase[] = [
      { id: 'discovery', name: 'File Discovery', status: 'pending', progress: 0 },
      { id: 'documentation', name: 'Documentation Analysis', status: 'pending', progress: 0 },
      { id: 'vectors', name: 'Vector Generation', status: 'pending', progress: 0 },
      { id: 'lineage', name: 'Lineage Extraction', status: 'pending', progress: 0 },
      { id: 'dependencies', name: 'Dependency Resolution', status: 'pending', progress: 0 },
      { id: 'analysis', name: 'Impact Analysis', status: 'pending', progress: 0 }
    ];

    try {
      // Phase 1: File Discovery
      await MetadataProcessingController.executePhase(
        processingPhases[0],
        async () => await MetadataProcessingController.discoverFiles(repositoryId)
      );

      // Phase 2: Documentation Analysis (Phase 2A)
      await MetadataProcessingController.executePhase(
        processingPhases[1],
        async () => await MetadataProcessingController.processDocumentation(repositoryId)
      );

      // Phase 3: Vector Generation
      await MetadataProcessingController.executePhase(
        processingPhases[2],
        async () => await MetadataProcessingController.generateVectors(repositoryId)
      );

      // Phase 4: Lineage Extraction (Phase 2B)
      await MetadataProcessingController.executePhase(
        processingPhases[3],
        async () => await MetadataProcessingController.extractLineage(repositoryId)
      );

      // Phase 5: Dependency Resolution (Phase 2D)
      await MetadataProcessingController.executePhase(
        processingPhases[4],
        async () => await MetadataProcessingController.resolveDependencies(repositoryId)
      );

      // Phase 6: Impact Analysis
      await MetadataProcessingController.executePhase(
        processingPhases[5],
        async () => await MetadataProcessingController.performImpactAnalysis(repositoryId)
      );

      // Update job status
      await supabase
        .from('processing_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: { phases: processingPhases }
        })
        .eq('id', jobId);

      console.log(`✅ Comprehensive metadata processing completed for repository: ${repositoryId}`);

    } catch (error) {
      console.error('Error in processing pipeline:', error);
      
      await supabase
        .from('processing_jobs')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }
  }

  /**
   * Execute a single processing phase
   */
  static async executePhase(phase: ProcessingPhase, action: () => Promise<any>) {
    try {
      phase.status = 'processing';
      phase.startTime = new Date();
      
      console.log(`📍 Starting phase: ${phase.name}`);
      
      const result = await action();
      
      phase.status = 'completed';
      phase.endTime = new Date();
      phase.progress = 100;
      phase.details = result;
      
      console.log(`✅ Completed phase: ${phase.name}`);
      
    } catch (error) {
      phase.status = 'error';
      phase.endTime = new Date();
      phase.details = { error: error instanceof Error ? error.message : 'Unknown error' };
      
      console.error(`❌ Error in phase ${phase.name}:`, error);
      throw error;
    }
  }

  /**
   * Phase 1: File Discovery
   */
  static async discoverFiles(repositoryId: string) {
    console.log('🔍 Discovering files...');
    
    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .eq('repository_id', repositoryId);

    if (error) throw error;

    return {
      totalFiles: files?.length || 0,
      fileTypes: files?.reduce((acc: any, file) => {
        acc[file.language] = (acc[file.language] || 0) + 1;
        return acc;
      }, {}) || {}
    };
  }

  /**
   * Phase 2: Documentation Analysis
   */
  static async processDocumentation(repositoryId: string) {
    console.log('📚 Processing documentation...');
    
    // Get files that need documentation processing
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('repository_id', repositoryId)
      .is('documentation_status', null);

    if (filesError) throw filesError;

    let processedCount = 0;
    
    for (const file of files || []) {
      try {
        // Create processing job for each file
        await supabase
          .from('processing_jobs')
          .insert({
            repository_id: repositoryId,
            file_id: file.id,
            job_type: 'documentation',
            status: 'pending'
          });
        
        processedCount++;
      } catch (error) {
        console.error(`Error processing file ${file.file_path}:`, error);
      }
    }

    return {
      processedFiles: processedCount,
      totalFiles: files?.length || 0
    };
  }

  /**
   * Phase 3: Vector Generation
   */
  static async generateVectors(repositoryId: string) {
    console.log('🔢 Generating vectors...');
    
    // Call vector generation endpoint
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/code-processor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation: 'generate_vectors',
        repositoryId
      })
    });

    if (!response.ok) {
      throw new Error(`Vector generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Phase 4: Lineage Extraction
   */
  static async extractLineage(repositoryId: string) {
    console.log('🔗 Extracting lineage...');
    
    // Call lineage extraction endpoint
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/code-processor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation: 'extract_lineage',
        repositoryId
      })
    });

    if (!response.ok) {
      throw new Error(`Lineage extraction failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Phase 5: Dependency Resolution (NEW - Phase 2D)
   */
  static async resolveDependencies(repositoryId: string) {
    console.log('🕸️ Resolving dependencies...');
    
    // Get all data assets for dependency analysis
    const { data: assets, error: assetsError } = await supabase
      .from('data_assets')
      .select(`
        *,
        file:files(id, file_path, language),
        columns:data_columns(*)
      `)
      .eq('files.repository_id', repositoryId);

    if (assetsError) throw assetsError;

    // Build column dependency graph
    let columnDependencies = 0;
    let crossFileRelationships = 0;

    for (const asset of assets || []) {
      for (const column of asset.columns || []) {
        // Analyze column dependencies using database function
        try {
          const { data: columnImpact } = await supabase
            .rpc('analyze_column_impact', {
              p_column_id: column.id,
              p_max_depth: 5
            });

          if (columnImpact && columnImpact.length > 0) {
            columnDependencies += columnImpact.length;
          }
        } catch (error) {
          console.warn(`Could not analyze column ${column.column_name}:`, error);
        }
      }
    }

    // Analyze cross-file relationships
    const { data: fileDeps, error: fileDepsError } = await supabase
      .from('file_dependencies')
      .select('*')
      .eq('files.repository_id', repositoryId);

    if (!fileDepsError) {
      crossFileRelationships = fileDeps?.length || 0;
    }

    // Calculate repository health
    const repositoryHealth = MetadataProcessingController.calculateRepositoryHealth({
      totalAssets: assets?.length || 0,
      columnDependencies,
      crossFileRelationships,
      circularDependencies: [] // TODO: Implement circular dependency detection
    });

    return {
      dependenciesResolved: columnDependencies + crossFileRelationships,
      analysis: {
        columnDependencies,
        crossFileRelationships,
        circularDependencies: [], // TODO: Implement
        repositoryHealth
      }
    };
  }

  /**
   * Phase 6: Impact Analysis
   */
  static async performImpactAnalysis(repositoryId: string) {
    console.log('📊 Performing impact analysis...');
    
    // Get comprehensive metadata
    const { data: metadata, error } = await supabase
      .from('files')
      .select(`
        id,
        file_path,
        language,
        data_assets(
          id,
          asset_name,
          asset_type,
          data_columns(id, column_name, column_type)
        ),
        code_functions(id, function_name, function_type)
      `)
      .eq('repository_id', repositoryId);

    if (error) throw error;

    const metadataItems = [];
    
    for (const file of metadata || []) {
      // Add file metadata
      metadataItems.push({
        id: file.id,
        name: file.file_path,
        type: 'file',
        language: file.language,
        status: 'completed',
        dependencies: file.data_assets?.length || 0,
        impactLevel: MetadataProcessingController.calculateImpactLevel(file)
      });

      // Add asset metadata
      for (const asset of file.data_assets || []) {
        metadataItems.push({
          id: asset.id,
          name: asset.asset_name,
          type: 'asset',
          language: file.language,
          status: 'completed',
          dependencies: asset.data_columns?.length || 0,
          impactLevel: MetadataProcessingController.calculateImpactLevel(asset)
        });

        // Add column metadata
        for (const column of asset.data_columns || []) {
          metadataItems.push({
            id: column.id,
            name: column.column_name,
            type: 'column',
            language: file.language,
            status: 'completed',
            impactLevel: 'medium' // Default for columns
          });
        }
      }

      // Add function metadata
      for (const func of file.code_functions || []) {
        metadataItems.push({
          id: func.id,
          name: func.function_name,
          type: 'function',
          language: file.language,
          status: 'completed',
          impactLevel: 'low' // Default for functions
        });
      }
    }

    return {
      items: metadataItems,
      summary: {
        totalItems: metadataItems.length,
        byType: metadataItems.reduce((acc: any, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {}),
        byLanguage: metadataItems.reduce((acc: any, item) => {
          acc[item.language] = (acc[item.language] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }

  /**
   * Get processing status
   */
  static async getProcessingStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params;

      const { data: job, error } = await supabase
        .from('processing_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);

    } catch (error) {
      console.error('Error getting processing status:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get repository metadata summary
   */
  static async getRepositoryMetadata(req: Request, res: Response) {
    try {
      const { repositoryId } = req.params;

      // Get comprehensive metadata
      const { data: metadata, error } = await supabase
        .from('files')
        .select(`
          id,
          file_path,
          language,
          data_assets(
            id,
            asset_name,
            asset_type,
            data_columns(id, column_name, column_type)
          ),
          code_functions(id, function_name, function_type)
        `)
        .eq('repository_id', repositoryId);

      if (error) throw error;

      const items = [];
      
      for (const file of metadata || []) {
        items.push({
          id: file.id,
          name: file.file_path,
          type: 'file',
          language: file.language,
          status: 'completed',
          dependencies: file.data_assets?.length || 0
        });

        for (const asset of file.data_assets || []) {
          items.push({
            id: asset.id,
            name: asset.asset_name,
            type: 'asset',
            language: file.language,
            status: 'completed',
            dependencies: asset.data_columns?.length || 0
          });
        }
      }

      res.json({ items });

    } catch (error) {
      console.error('Error getting repository metadata:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate repository health score
   */
  private static calculateRepositoryHealth(stats: any) {
    let score = 100;
    const factors = [];

    // Penalize for high complexity
    if (stats.columnDependencies > 100) {
      score -= 20;
      factors.push('High column dependency count');
    }

    // Penalize for circular dependencies
    if (stats.circularDependencies.length > 0) {
      score -= stats.circularDependencies.length * 10;
      factors.push(`${stats.circularDependencies.length} circular dependencies`);
    }

    // Bonus for good asset distribution
    if (stats.totalAssets > 10 && stats.totalAssets < 100) {
      score += 5;
      factors.push('Good asset distribution');
    }

    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    return {
      score: Math.max(0, Math.min(100, score)),
      grade,
      factors
    };
  }

  /**
   * Calculate impact level for metadata items
   */
  private static calculateImpactLevel(item: any): 'low' | 'medium' | 'high' | 'critical' {
    // Simple heuristic - can be enhanced with more sophisticated analysis
    if (item.data_assets && item.data_assets.length > 5) return 'high';
    if (item.data_columns && item.data_columns.length > 10) return 'high';
    if (item.asset_type === 'table' || item.asset_type === 'view') return 'medium';
    return 'low';
  }
}