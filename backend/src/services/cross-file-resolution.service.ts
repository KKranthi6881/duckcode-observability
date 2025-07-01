import { supabase } from '../config/supabase';

export interface CrossFileResolutionResult {
  resolvedRelationships: number;
  executionOrder: ExecutionOrderNode[];
  circularDependencies: CircularDependency[];
  dataFlowPatterns: DataFlowPattern[];
  impactAnalysis?: ImpactAnalysisResult[];
}

export interface ExecutionOrderNode {
  fileId: string;
  filePath: string;
  executionLevel: number;
  dependenciesCount: number;
  dependentsCount: number;
  isSource: boolean;
  isSink: boolean;
  criticalityScore: number;
}

export interface CircularDependency {
  cycleId: string;
  filePath: string;
  dependencyPath: string[];
  cycleLength: number;
  severity: 'low' | 'medium' | 'high';
}

export interface DataFlowPattern {
  patternType: 'etl_pipeline' | 'fan_out' | 'fan_in';
  sourceFiles: string[];
  targetFiles: string[];
  dataVolumeEstimate: number;
  transformationComplexity: number;
  businessImpact: string;
  optimizationOpportunities: string[];
}

export interface ImpactAnalysisResult {
  impactedFileId: string;
  impactedFilePath: string;
  impactType: 'direct_dependency' | 'indirect_dependency';
  impactSeverity: 'low' | 'medium' | 'high';
  estimatedEffortHours: number;
  riskFactors: string[];
  mitigationStrategies: string[];
}

export interface CrossFileAssetReference {
  sourceFileId: string;
  sourceAssetName: string;
  targetFileId: string;
  targetAssetName: string;
  relationshipType: string;
  confidenceScore: number;
  resolutionMethod: string;
}

export class CrossFileResolutionService {
  /**
   * Perform comprehensive cross-file resolution for a repository
   */
  async resolveRepositoryRelationships(repositoryId: string): Promise<CrossFileResolutionResult> {
    try {
      console.log(`Starting cross-file resolution for repository: ${repositoryId}`);
      
      // Step 1: Resolve asset references across files
      const resolvedCount = await this.resolveAssetReferences(repositoryId);
      
      // Step 2: Calculate execution order
      const executionOrder = await this.calculateExecutionOrder(repositoryId);
      
      // Step 3: Detect circular dependencies
      const circularDependencies = await this.detectCircularDependencies(repositoryId);
      
      // Step 4: Analyze data flow patterns
      const dataFlowPatterns = await this.analyzeDataFlowPatterns(repositoryId);
      
      console.log(`Cross-file resolution completed: ${resolvedCount} relationships resolved`);
      
      return {
        resolvedRelationships: resolvedCount,
        executionOrder,
        circularDependencies,
        dataFlowPatterns
      };
      
    } catch (error) {
      console.error('Error in cross-file resolution:', error);
      throw new Error(`Cross-file resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Resolve asset references across files
   */
  private async resolveAssetReferences(repositoryId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('resolve_asset_references', {
          p_repository_id: repositoryId
        });
        
      if (error) {
        throw new Error(`Failed to resolve asset references: ${error.message}`);
      }
      
      return data || 0;
      
    } catch (error) {
      console.error('Error resolving asset references:', error);
      throw error;
    }
  }
  
  /**
   * Calculate execution order for files in repository
   */
  async calculateExecutionOrder(repositoryId: string): Promise<ExecutionOrderNode[]> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_execution_order', {
          p_repository_id: repositoryId
        });
        
      if (error) {
        throw new Error(`Failed to calculate execution order: ${error.message}`);
      }
      
      return (data || []).map((row: any) => ({
        fileId: row.file_id,
        filePath: row.file_path,
        executionLevel: row.execution_level,
        dependenciesCount: row.dependencies_count,
        dependentsCount: row.dependents_count,
        isSource: row.is_source,
        isSink: row.is_sink,
        criticalityScore: parseFloat(row.criticality_score)
      }));
      
    } catch (error) {
      console.error('Error calculating execution order:', error);
      throw error;
    }
  }
  
  /**
   * Detect circular dependencies
   */
  async detectCircularDependencies(repositoryId: string): Promise<CircularDependency[]> {
    try {
      const { data, error } = await supabase
        .rpc('detect_circular_dependencies', {
          p_repository_id: repositoryId
        });
        
      if (error) {
        throw new Error(`Failed to detect circular dependencies: ${error.message}`);
      }
      
      return (data || []).map((row: any) => ({
        cycleId: row.cycle_id,
        filePath: row.file_path,
        dependencyPath: row.dependency_path,
        cycleLength: row.cycle_length,
        severity: row.severity
      }));
      
    } catch (error) {
      console.error('Error detecting circular dependencies:', error);
      throw error;
    }
  }
  
  /**
   * Analyze data flow patterns
   */
  async analyzeDataFlowPatterns(repositoryId: string): Promise<DataFlowPattern[]> {
    try {
      const { data, error } = await supabase
        .rpc('analyze_data_flow_patterns', {
          p_repository_id: repositoryId
        });
        
      if (error) {
        throw new Error(`Failed to analyze data flow patterns: ${error.message}`);
      }
      
      return (data || []).map((row: any) => ({
        patternType: row.pattern_type,
        sourceFiles: row.source_files,
        targetFiles: row.target_files,
        dataVolumeEstimate: row.data_volume_estimate,
        transformationComplexity: parseFloat(row.transformation_complexity),
        businessImpact: row.business_impact,
        optimizationOpportunities: row.optimization_opportunities
      }));
      
    } catch (error) {
      console.error('Error analyzing data flow patterns:', error);
      throw error;
    }
  }
  
  /**
   * Generate impact analysis for a specific file
   */
  async generateImpactAnalysis(
    fileId: string, 
    changeType: string = 'modification'
  ): Promise<ImpactAnalysisResult[]> {
    try {
      const { data, error } = await supabase
        .rpc('generate_impact_analysis', {
          p_file_id: fileId,
          p_change_type: changeType
        });
        
      if (error) {
        throw new Error(`Failed to generate impact analysis: ${error.message}`);
      }
      
      return (data || []).map((row: any) => ({
        impactedFileId: row.impacted_file_id,
        impactedFilePath: row.impacted_file_path,
        impactType: row.impact_type,
        impactSeverity: row.impact_severity,
        estimatedEffortHours: parseFloat(row.estimated_effort_hours),
        riskFactors: row.risk_factors,
        mitigationStrategies: row.mitigation_strategies
      }));
      
    } catch (error) {
      console.error('Error generating impact analysis:', error);
      throw error;
    }
  }
  
  /**
   * Get cross-file asset references for a repository
   */
  async getCrossFileAssetReferences(repositoryId: string): Promise<CrossFileAssetReference[]> {
    try {
      const { data, error } = await supabase
        .rpc('resolve_cross_file_assets', {
          p_repository_id: repositoryId
        });
        
      if (error) {
        throw new Error(`Failed to get cross-file asset references: ${error.message}`);
      }
      
      return (data || []).map((row: any) => ({
        sourceFileId: row.source_file_id,
        sourceAssetName: row.source_asset_name,
        targetFileId: row.target_file_id,
        targetAssetName: row.target_asset_name,
        relationshipType: row.relationship_type,
        confidenceScore: parseFloat(row.confidence_score),
        resolutionMethod: row.resolution_method
      }));
      
    } catch (error) {
      console.error('Error getting cross-file asset references:', error);
      throw error;
    }
  }
  
  /**
   * Process cross-file resolution for multiple repositories in batch
   */
  async processBatchResolution(repositoryIds: string[]): Promise<{
    successful: number;
    failed: number;
    results: { [repositoryId: string]: CrossFileResolutionResult };
    errors: { [repositoryId: string]: string };
  }> {
    const results: { [repositoryId: string]: CrossFileResolutionResult } = {};
    const errors: { [repositoryId: string]: string } = {};
    let successful = 0;
    let failed = 0;
    
    // Process repositories in parallel with concurrency limit
    const concurrency = 3;
    const chunks = [];
    
    for (let i = 0; i < repositoryIds.length; i += concurrency) {
      chunks.push(repositoryIds.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (repositoryId) => {
        try {
          const result = await this.resolveRepositoryRelationships(repositoryId);
          results[repositoryId] = result;
          successful++;
                 } catch (error) {
           errors[repositoryId] = error instanceof Error ? error.message : 'Unknown error';
           failed++;
         }
      });
      
      await Promise.allSettled(promises);
    }
    
    return {
      successful,
      failed,
      results,
      errors
    };
  }
  
  /**
   * Get repository dependency statistics
   */
  async getRepositoryDependencyStats(repositoryId: string): Promise<{
    totalFiles: number;
    filesWithDependencies: number;
    filesWithDependents: number;
    averageDependenciesPerFile: number;
    maxDependencyDepth: number;
    circularDependencyCount: number;
    criticalFiles: ExecutionOrderNode[];
  }> {
    try {
      const executionOrder = await this.calculateExecutionOrder(repositoryId);
      const circularDependencies = await this.detectCircularDependencies(repositoryId);
      
      const totalFiles = executionOrder.length;
      const filesWithDependencies = executionOrder.filter(f => f.dependenciesCount > 0).length;
      const filesWithDependents = executionOrder.filter(f => f.dependentsCount > 0).length;
      const averageDependenciesPerFile = totalFiles > 0 
        ? executionOrder.reduce((sum, f) => sum + f.dependenciesCount, 0) / totalFiles 
        : 0;
      const maxDependencyDepth = Math.max(...executionOrder.map(f => f.executionLevel), 0);
      const criticalFiles = executionOrder
        .filter(f => f.criticalityScore > 0.7)
        .sort((a, b) => b.criticalityScore - a.criticalityScore)
        .slice(0, 10);
      
      return {
        totalFiles,
        filesWithDependencies,
        filesWithDependents,
        averageDependenciesPerFile,
        maxDependencyDepth,
        circularDependencyCount: circularDependencies.length,
        criticalFiles
      };
      
    } catch (error) {
      console.error('Error getting repository dependency stats:', error);
      throw error;
    }
  }
  
  /**
   * Suggest optimization opportunities based on analysis
   */
  async suggestOptimizations(repositoryId: string): Promise<{
    type: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
    affectedFiles: string[];
    estimatedImpact: string;
    implementationEffort: string;
  }[]> {
    try {
      const [executionOrder, circularDependencies, dataFlowPatterns] = await Promise.all([
        this.calculateExecutionOrder(repositoryId),
        this.detectCircularDependencies(repositoryId),
        this.analyzeDataFlowPatterns(repositoryId)
      ]);
      
      const optimizations = [];
      
      // Circular dependency optimization
      if (circularDependencies.length > 0) {
        optimizations.push({
          type: 'circular_dependency_resolution',
          priority: 'high' as const,
          description: `Resolve ${circularDependencies.length} circular dependencies to improve maintainability`,
          affectedFiles: circularDependencies.map(cd => cd.filePath),
          estimatedImpact: 'Improved code maintainability and reduced complexity',
          implementationEffort: 'Medium - requires refactoring to break cycles'
        });
      }
      
      // Critical file optimization
      const criticalFiles = executionOrder.filter(f => f.criticalityScore > 0.8);
      if (criticalFiles.length > 0) {
        optimizations.push({
          type: 'critical_file_monitoring',
          priority: 'medium' as const,
          description: `Add enhanced monitoring for ${criticalFiles.length} critical files`,
          affectedFiles: criticalFiles.map(f => f.filePath),
          estimatedImpact: 'Better visibility into system health and performance',
          implementationEffort: 'Low - add monitoring and alerting'
        });
      }
      
      // Parallel processing opportunities
      const parallelizable = executionOrder.filter(f => f.executionLevel > 0 && f.dependenciesCount === 0);
      if (parallelizable.length > 2) {
        optimizations.push({
          type: 'parallel_processing',
          priority: 'medium' as const,
          description: `Enable parallel processing for ${parallelizable.length} independent files`,
          affectedFiles: parallelizable.map(f => f.filePath),
          estimatedImpact: 'Reduced processing time through parallelization',
          implementationEffort: 'Medium - implement parallel execution framework'
        });
      }
      
      // Data flow optimization
      const fanOutPatterns = dataFlowPatterns.filter(p => p.patternType === 'fan_out');
      if (fanOutPatterns.length > 0) {
        optimizations.push({
          type: 'data_distribution_optimization',
          priority: 'low' as const,
          description: `Optimize data distribution patterns for better performance`,
          affectedFiles: fanOutPatterns.flatMap(p => p.sourceFiles),
          estimatedImpact: 'Improved data processing efficiency',
          implementationEffort: 'High - requires architecture changes'
        });
      }
      
      return optimizations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
    } catch (error) {
      console.error('Error suggesting optimizations:', error);
      throw error;
    }
  }
} 