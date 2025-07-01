import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { CrossFileResolutionService } from '../../services/cross-file-resolution.service';

// Define AuthenticatedRequest interface locally
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

/**
 * Initiates lineage processing for a repository that already has documentation
 */
export async function processRepositoryLineage(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const { fileTypes, forceReprocess = false } = req.body;
    const userId = req.user.id;

    // Validate repository exists and user has access
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('id, file_path, language')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId);

    if (filesError) {
      console.error('Error fetching files:', filesError);
      return res.status(500).json({ error: 'Failed to fetch repository files' });
    }

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found or no files available' });
    }

    // Filter files that have completed documentation but need lineage processing
    let eligibleFiles = files;
    
    if (fileTypes && Array.isArray(fileTypes)) {
      eligibleFiles = files.filter(file => 
        fileTypes.some(type => file.language?.toLowerCase().includes(type.toLowerCase()))
      );
    }

    // Get processing jobs to check which files need lineage processing
    const { data: jobs, error: jobsError } = await supabase
      .from('code_insights.processing_jobs')
      .select('file_id, status, lineage_status')
      .in('file_id', eligibleFiles.map(f => f.id));

    if (jobsError) {
      console.error('Error fetching processing jobs:', jobsError);
      return res.status(500).json({ error: 'Failed to fetch processing status' });
    }

    // Determine which files need lineage processing
    const jobsMap = new Map(jobs?.map(job => [job.file_id, job]) || []);
    const filesToProcess = eligibleFiles.filter(file => {
      const job = jobsMap.get(file.id);
      if (!job) return false; // No job means no documentation yet
      
      // Process if documentation is complete and lineage is pending/failed, or if force reprocess
      return job.status === 'completed' && (
        forceReprocess || 
        job.lineage_status === 'pending' || 
        job.lineage_status === 'failed' ||
        !job.lineage_status
      );
    });

    if (filesToProcess.length === 0) {
      return res.status(400).json({ 
        error: 'No files eligible for lineage processing. Ensure documentation is complete first.' 
      });
    }

    // Update lineage status to pending for eligible files
    const { error: updateError } = await supabase
      .from('code_insights.processing_jobs')
      .update({ 
        lineage_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .in('file_id', filesToProcess.map(f => f.id));

    if (updateError) {
      console.error('Error updating lineage status:', updateError);
      return res.status(500).json({ error: 'Failed to queue lineage processing' });
    }

    res.status(202).json({
      message: 'Lineage processing queued successfully',
      filesQueued: filesToProcess.length,
      files: filesToProcess.map(f => ({
        id: f.id,
        path: f.file_path,
        language: f.language
      }))
    });

  } catch (error) {
    console.error('Error in processRepositoryLineage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Gets the lineage processing status for a repository
 */
export async function getLineageStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const userId = req.user.id;

    // Get lineage statistics using our database function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_lineage_stats', { p_repository_name: repositoryFullName });

    if (statsError) {
      console.error('Error fetching lineage stats:', statsError);
      return res.status(500).json({ error: 'Failed to fetch lineage statistics' });
    }

    if (!stats || stats.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const statistics = stats[0];

    // Calculate progress metrics
    const totalFiles = statistics.total_files || 0;
    const filesWithLineage = statistics.files_with_lineage || 0;
    const progressPercentage = totalFiles > 0 ? (filesWithLineage / totalFiles) * 100 : 0;

    // Determine overall status
    let overallStatus = 'pending';
    if (filesWithLineage === totalFiles && totalFiles > 0) {
      overallStatus = 'completed';
    } else if (filesWithLineage > 0) {
      overallStatus = 'processing';
    }

    res.json({
      status: overallStatus,
      statistics: {
        totalFiles: statistics.total_files,
        filesWithLineage: statistics.files_with_lineage,
        totalAssets: statistics.total_assets,
        totalRelationships: statistics.total_relationships,
        avgConfidenceScore: statistics.avg_confidence_score,
        assetTypeBreakdown: statistics.asset_type_breakdown,
        relationshipTypeBreakdown: statistics.relationship_type_breakdown
      },
      progress: {
        completed: filesWithLineage,
        total: totalFiles,
        percentage: Math.round(progressPercentage * 100) / 100
      }
    });

  } catch (error) {
    console.error('Error in getLineageStatus:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Gets all discovered data assets for a repository
 */
export async function getDataAssets(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const { assetType, search, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = supabase
      .from('code_insights.data_assets')
      .select(`
        id,
        asset_name,
        asset_type,
        schema_name,
        database_name,
        full_qualified_name,
        asset_metadata,
        created_at,
        updated_at,
        files!inner(file_path, language)
      `)
      .eq('files.repository_full_name', repositoryFullName)
      .eq('files.user_id', userId);

    // Apply filters
    if (assetType) {
      query = query.eq('asset_type', assetType);
    }

    if (search) {
      query = query.or(`asset_name.ilike.%${search}%,full_qualified_name.ilike.%${search}%`);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('code_insights.data_assets')
      .select('id', { count: 'exact', head: true })
      .eq('files.repository_full_name', repositoryFullName)
      .eq('files.user_id', userId);

    // Apply pagination and get data
    const { data: assets, error } = await query.range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error('Error fetching data assets:', error);
      return res.status(500).json({ error: 'Failed to fetch data assets' });
    }

    res.json({
      assets: (assets as any[])?.map((asset: any) => ({
        id: asset.id,
        assetName: asset.asset_name,
        assetType: asset.asset_type,
        schemaName: asset.schema_name,
        databaseName: asset.database_name,
        fullQualifiedName: asset.full_qualified_name,
        filePath: asset.files?.file_path,
        language: asset.files?.language,
        metadata: asset.asset_metadata,
        createdAt: asset.created_at,
        updatedAt: asset.updated_at
      })) || [],
      pagination: {
        total: count || 0,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: (Number(offset) + Number(limit)) < (count || 0)
      }
    });

  } catch (error) {
    console.error('Error in getDataAssets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Gets lineage relationships for a repository
 */
export async function getLineageRelationships(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const { assetId, relationshipType, minConfidence = 0.5, limit = 100 } = req.query;
    const userId = req.user.id;

    let query = supabase
      .from('code_insights.data_lineage')
      .select(`
        id,
        relationship_type,
        operation_type,
        confidence_score,
        transformation_logic,
        business_context,
        discovered_at_line,
        join_conditions,
        filter_conditions,
        aggregation_logic,
        created_at,
        source_asset:source_asset_id(
          id,
          asset_name,
          asset_type,
          full_qualified_name,
          files!inner(file_path)
        ),
        target_asset:target_asset_id(
          id,
          asset_name,
          asset_type,
          full_qualified_name,
          files!inner(file_path)
        ),
        discovered_file:discovered_in_file_id(
          file_path,
          language
        )
      `)
      .gte('confidence_score', Number(minConfidence))
      .order('confidence_score', { ascending: false })
      .limit(Number(limit));

    // Apply filters
    if (assetId) {
      query = query.or(`source_asset_id.eq.${assetId},target_asset_id.eq.${assetId}`);
    }

    if (relationshipType) {
      query = query.eq('relationship_type', relationshipType);
    }

    const { data: relationships, error } = await query;

    if (error) {
      console.error('Error fetching lineage relationships:', error);
      return res.status(500).json({ error: 'Failed to fetch lineage relationships' });
    }

    res.json({
      relationships: (relationships as any[])?.map((rel: any) => ({
        id: rel.id,
        sourceAsset: {
          id: rel.source_asset?.id,
          name: rel.source_asset?.asset_name,
          type: rel.source_asset?.asset_type,
          fullQualifiedName: rel.source_asset?.full_qualified_name,
          filePath: rel.source_asset?.files?.file_path
        },
        targetAsset: {
          id: rel.target_asset?.id,
          name: rel.target_asset?.asset_name,
          type: rel.target_asset?.asset_type,
          fullQualifiedName: rel.target_asset?.full_qualified_name,
          filePath: rel.target_asset?.files?.file_path
        },
        relationshipType: rel.relationship_type,
        operationType: rel.operation_type,
        confidenceScore: rel.confidence_score,
        transformationLogic: rel.transformation_logic,
        businessContext: rel.business_context,
        discoveredAtLine: rel.discovered_at_line,
        joinConditions: rel.join_conditions,
        filterConditions: rel.filter_conditions,
        aggregationLogic: rel.aggregation_logic,
        discoveredInFile: {
          path: rel.discovered_file?.file_path,
          language: rel.discovered_file?.language
        },
        createdAt: rel.created_at
      })) || [],
      total: relationships?.length || 0
    });

  } catch (error) {
    console.error('Error in getLineageRelationships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Gets lineage graph data for visualization
 */
export async function getLineageGraph(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const { focusAsset, depth = 2, includeColumns = false } = req.query;
    const userId = req.user.id;

    // Get assets for the repository
    const { data: assets, error: assetsError } = await supabase
      .from('code_insights.data_assets')
      .select(`
        id,
        asset_name,
        asset_type,
        full_qualified_name,
        asset_metadata,
        files!inner(file_path, language, complexity_score, business_criticality)
      `)
      .eq('files.repository_full_name', repositoryFullName)
      .eq('files.user_id', userId);

    if (assetsError) {
      console.error('Error fetching assets for graph:', assetsError);
      return res.status(500).json({ error: 'Failed to fetch assets' });
    }

    // Get relationships
    let relationshipsQuery = supabase
      .from('code_insights.data_lineage')
      .select(`
        id,
        source_asset_id,
        target_asset_id,
        relationship_type,
        confidence_score,
        transformation_logic,
        business_context
      `)
      .in('source_asset_id', (assets as any[])?.map(a => a.id) || [])
      .gte('confidence_score', 0.5);

    const { data: relationships, error: relationshipsError } = await relationshipsQuery;

    if (relationshipsError) {
      console.error('Error fetching relationships for graph:', relationshipsError);
      return res.status(500).json({ error: 'Failed to fetch relationships' });
    }

    // Filter assets and relationships based on focus and depth
    let filteredAssets = assets as any[] || [];
    let filteredRelationships = relationships as any[] || [];

    if (focusAsset) {
      // Filter to show only assets connected to the focus asset within specified depth
      const connectedAssetIds = new Set([focusAsset]);
      
      // Iteratively expand the set of connected assets up to the specified depth
      for (let i = 0; i < Number(depth); i++) {
        const newConnections = new Set();
        filteredRelationships.forEach(rel => {
          if (connectedAssetIds.has(rel.source_asset_id)) {
            newConnections.add(rel.target_asset_id);
          }
          if (connectedAssetIds.has(rel.target_asset_id)) {
            newConnections.add(rel.source_asset_id);
          }
        });
        
        newConnections.forEach(id => connectedAssetIds.add(String(id)));
      }
      
      filteredAssets = filteredAssets.filter(asset => connectedAssetIds.has(asset.id));
      filteredRelationships = filteredRelationships.filter(rel => 
        connectedAssetIds.has(rel.source_asset_id) && 
        connectedAssetIds.has(rel.target_asset_id)
      ) || [];
    }

    // Format for graph visualization
    const nodes = filteredAssets.map((asset: any) => ({
      id: asset.id,
      name: asset.asset_name,
      type: asset.asset_type,
      fullQualifiedName: asset.full_qualified_name,
      filePath: asset.files?.file_path,
      language: asset.files?.language,
      metadata: {
        ...asset.asset_metadata,
        complexityScore: asset.files?.complexity_score,
        businessCriticality: asset.files?.business_criticality
      }
    }));

    const edges = filteredRelationships.map((rel: any) => ({
      id: rel.id,
      source: rel.source_asset_id,
      target: rel.target_asset_id,
      type: rel.relationship_type,
      confidence: rel.confidence_score,
      metadata: {
        transformationLogic: rel.transformation_logic,
        businessContext: rel.business_context
      }
    }));

    res.json({
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        focusAsset,
        depth: Number(depth),
        includeColumns: includeColumns === 'true'
      }
    });

  } catch (error) {
    console.error('Error in getLineageGraph:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Gets impact analysis for changes to a specific asset
 */
export async function getImpactAnalysis(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName, assetId } = req.params;
    const { changeType, maxDepth = 5 } = req.query;
    const userId = req.user.id;

    // Get the asset being changed
    const { data: changedAsset, error: assetError } = await supabase
      .from('code_insights.data_assets')
      .select(`
        id,
        asset_name,
        asset_type,
        full_qualified_name,
        asset_metadata,
        files!inner(file_path, language, business_criticality)
      `)
      .eq('id', assetId)
      .eq('files.repository_full_name', repositoryFullName)
      .eq('files.user_id', userId)
      .single();

    if (assetError || !changedAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Perform impact analysis by traversing downstream dependencies
    const impactedAssets: any[] = [];
    const visitedAssets = new Set();
    const assetsToAnalyze = [{ assetId, depth: 0 }];

    while (assetsToAnalyze.length > 0) {
      const { assetId: currentAssetId, depth: currentDepth } = assetsToAnalyze.shift()!;
      
      if (visitedAssets.has(currentAssetId) || currentDepth >= Number(maxDepth)) {
        continue;
      }
      
      visitedAssets.add(currentAssetId);

      // Get downstream dependencies
      const { data: dependencies, error: depsError } = await supabase
        .from('code_insights.data_lineage')
        .select(`
          id,
          target_asset_id,
          relationship_type,
          confidence_score,
          transformation_logic,
          target_asset:target_asset_id(
            id,
            asset_name,
            asset_type,
            full_qualified_name,
            files!inner(file_path, business_criticality)
          )
        `)
        .eq('source_asset_id', currentAssetId)
        .gte('confidence_score', 0.6);

      if (depsError) {
        console.error('Error fetching dependencies:', depsError);
        continue;
      }

      (dependencies as any[])?.forEach((dep: any) => {
        if (!visitedAssets.has(dep.target_asset_id)) {
          // Determine impact severity based on relationship type and business criticality
          let severity = 'medium';
          const businessCriticality = dep.target_asset?.files?.business_criticality;
          
          if (businessCriticality === 'critical' || dep.relationship_type === 'writes_to') {
            severity = 'critical';
          } else if (businessCriticality === 'high' || dep.confidence_score > 0.9) {
            severity = 'high';
          } else if (businessCriticality === 'low' || dep.confidence_score < 0.7) {
            severity = 'low';
          }

          // Determine impact type based on change type
          let impactType = 'warning';
          if (changeType === 'table_dropped' || changeType === 'column_removed') {
            impactType = 'breaking';
          } else if (changeType === 'type_changed') {
            impactType = 'breaking';
          } else if (changeType === 'column_added') {
            impactType = 'info';
          }

          impactedAssets.push({
            asset: {
              id: dep.target_asset?.id,
              name: dep.target_asset?.asset_name,
              type: dep.target_asset?.asset_type,
              fullQualifiedName: dep.target_asset?.full_qualified_name,
              filePath: dep.target_asset?.files?.file_path,
              businessCriticality: dep.target_asset?.files?.business_criticality
            },
            impactType,
            severity,
            propagationDepth: currentDepth + 1,
            relationshipType: dep.relationship_type,
            confidenceScore: dep.confidence_score,
            description: `${dep.relationship_type} relationship with confidence ${dep.confidence_score}`
          });

          // Add to queue for further analysis
          assetsToAnalyze.push({
            assetId: dep.target_asset_id,
            depth: currentDepth + 1
          });
        }
      });
    }

    // Calculate summary statistics
    const summary = {
      totalImpacted: impactedAssets.length,
      criticalCount: impactedAssets.filter(a => a.severity === 'critical').length,
      highCount: impactedAssets.filter(a => a.severity === 'high').length,
      mediumCount: impactedAssets.filter(a => a.severity === 'medium').length,
      lowCount: impactedAssets.filter(a => a.severity === 'low').length
    };

    res.json({
      changedAsset: {
        id: (changedAsset as any).id,
        name: (changedAsset as any).asset_name,
        type: (changedAsset as any).asset_type,
        fullQualifiedName: (changedAsset as any).full_qualified_name,
        filePath: (changedAsset as any).files?.file_path,
        businessCriticality: (changedAsset as any).files?.business_criticality
      },
      impactedAssets,
      summary,
      metadata: {
        changeType,
        maxDepth: Number(maxDepth),
        analysisTimestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in getImpactAnalysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Initialize cross-file resolution service
const crossFileResolutionService = new CrossFileResolutionService();

/**
 * Perform cross-file relationship resolution for a repository
 */
export async function resolveCrossFileRelationships(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const userId = req.user.id;

    // Get repository ID
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('repository_id')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .limit(1);

    if (filesError || !files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repositoryId = files[0].repository_id;

    // Perform cross-file resolution
    const result = await crossFileResolutionService.resolveRepositoryRelationships(repositoryId);

    res.json({
      message: 'Cross-file relationship resolution completed',
      result
    });

  } catch (error) {
    console.error('Error in resolveCrossFileRelationships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get execution order for files in repository
 */
export async function getExecutionOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const userId = req.user.id;

    // Get repository ID
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('repository_id')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .limit(1);

    if (filesError || !files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repositoryId = files[0].repository_id;

    // Get execution order and dependency stats
    const [executionOrder, dependencyStats] = await Promise.all([
      crossFileResolutionService.calculateExecutionOrder(repositoryId),
      crossFileResolutionService.getRepositoryDependencyStats(repositoryId)
    ]);

    res.json({
      executionOrder,
      statistics: dependencyStats
    });

  } catch (error) {
    console.error('Error in getExecutionOrder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get circular dependencies for repository
 */
export async function getCircularDependencies(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const userId = req.user.id;

    // Get repository ID
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('repository_id')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .limit(1);

    if (filesError || !files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repositoryId = files[0].repository_id;

    // Get circular dependencies
    const circularDependencies = await crossFileResolutionService.detectCircularDependencies(repositoryId);

    res.json({
      circularDependencies,
      summary: {
        totalCycles: circularDependencies.length,
        severityBreakdown: {
          high: circularDependencies.filter(cd => cd.severity === 'high').length,
          medium: circularDependencies.filter(cd => cd.severity === 'medium').length,
          low: circularDependencies.filter(cd => cd.severity === 'low').length
        }
      }
    });

  } catch (error) {
    console.error('Error in getCircularDependencies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get data flow patterns for repository
 */
export async function getDataFlowPatterns(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const userId = req.user.id;

    // Get repository ID
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('repository_id')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .limit(1);

    if (filesError || !files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repositoryId = files[0].repository_id;

    // Get data flow patterns
    const dataFlowPatterns = await crossFileResolutionService.analyzeDataFlowPatterns(repositoryId);

    res.json({
      patterns: dataFlowPatterns,
      summary: {
        totalPatterns: dataFlowPatterns.length,
        patternTypes: {
          etl_pipeline: dataFlowPatterns.filter(p => p.patternType === 'etl_pipeline').length,
          fan_out: dataFlowPatterns.filter(p => p.patternType === 'fan_out').length,
          fan_in: dataFlowPatterns.filter(p => p.patternType === 'fan_in').length
        }
      }
    });

  } catch (error) {
    console.error('Error in getDataFlowPatterns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generate impact analysis for file changes
 */
export async function generateFileImpactAnalysis(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName, fileId } = req.params;
    const { changeType = 'modification' } = req.query;
    const userId = req.user.id;

    // Verify file belongs to user and repository
    const { data: file, error: fileError } = await supabase
      .from('code_insights.files')
      .select('id, file_path')
      .eq('id', fileId)
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate impact analysis
    const impactAnalysis = await crossFileResolutionService.generateImpactAnalysis(
      fileId, 
      String(changeType)
    );

    res.json({
      changedFile: {
        id: file.id,
        path: file.file_path
      },
      changeType,
      impactAnalysis,
      summary: {
        totalImpacted: impactAnalysis.length,
        severityBreakdown: {
          high: impactAnalysis.filter(ia => ia.impactSeverity === 'high').length,
          medium: impactAnalysis.filter(ia => ia.impactSeverity === 'medium').length,
          low: impactAnalysis.filter(ia => ia.impactSeverity === 'low').length
        },
        totalEstimatedEffort: impactAnalysis.reduce((sum, ia) => sum + ia.estimatedEffortHours, 0)
      }
    });

  } catch (error) {
    console.error('Error in generateFileImpactAnalysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get optimization suggestions for repository
 */
export async function getOptimizationSuggestions(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const userId = req.user.id;

    // Get repository ID
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('repository_id')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .limit(1);

    if (filesError || !files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repositoryId = files[0].repository_id;

    // Get optimization suggestions
    const optimizations = await crossFileResolutionService.suggestOptimizations(repositoryId);

    res.json({
      optimizations,
      summary: {
        totalSuggestions: optimizations.length,
        priorityBreakdown: {
          high: optimizations.filter(o => o.priority === 'high').length,
          medium: optimizations.filter(o => o.priority === 'medium').length,
          low: optimizations.filter(o => o.priority === 'low').length
        }
      }
    });

  } catch (error) {
    console.error('Error in getOptimizationSuggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get cross-file asset references
 */
export async function getCrossFileAssetReferences(req: AuthenticatedRequest, res: Response) {
  try {
    const { repositoryFullName } = req.params;
    const { confidenceThreshold = 0.5 } = req.query;
    const userId = req.user.id;

    // Get repository ID
    const { data: files, error: filesError } = await supabase
      .from('code_insights.files')
      .select('repository_id')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .limit(1);

    if (filesError || !files || files.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repositoryId = files[0].repository_id;

    // Get cross-file asset references
    const references = await crossFileResolutionService.getCrossFileAssetReferences(repositoryId);

    // Filter by confidence threshold
    const filteredReferences = references.filter(ref => 
      ref.confidenceScore >= Number(confidenceThreshold)
    );

    res.json({
      references: filteredReferences,
      summary: {
        totalReferences: filteredReferences.length,
        resolutionMethods: {
          import_reference: filteredReferences.filter(r => r.resolutionMethod === 'import_reference').length,
          name_matching: filteredReferences.filter(r => r.resolutionMethod === 'name_matching').length,
          qualified_name_matching: filteredReferences.filter(r => r.resolutionMethod === 'qualified_name_matching').length
        },
        relationshipTypes: {
          imports: filteredReferences.filter(r => r.relationshipType === 'imports').length,
          references: filteredReferences.filter(r => r.relationshipType === 'references').length,
          qualified_reference: filteredReferences.filter(r => r.relationshipType === 'qualified_reference').length
        }
      }
    });

  } catch (error) {
    console.error('Error in getCrossFileAssetReferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 