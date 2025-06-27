import { supabase } from '@/config/supabase';
import { 
  getLineagePromptForLanguage, 
  interpolatePrompt, 
  LineageExtractionResult 
} from '@/prompts/lineage-prompts';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProcessLineageJobParams {
  jobId: string;
  fileId: string;
  filePath: string;
  language: string;
  repositoryFullName: string;
  existingDocumentation?: any;
}

export class LineageService {
  /**
   * Process lineage extraction for a single file
   */
  async processFileLineage(params: ProcessLineageJobParams): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting lineage processing for ${params.filePath}`);
      
      // Get file content (either from GitHub or use existing documentation)
      const fileContent = await this.getFileContent(params);
      
      if (!fileContent) {
        throw new Error('Could not retrieve file content');
      }
      
      // Extract lineage using LLM
      const lineageResult = await this.extractLineageWithLLM(
        fileContent,
        params.filePath,
        params.language
      );
      
      // Store lineage data in database
      await this.storeLineageData(params.fileId, lineageResult);
      
      // Mark job as completed
      const processingTime = Date.now() - startTime;
      await this.completeLineageJob(params.jobId, lineageResult, processingTime);
      
      console.log(`Completed lineage processing for ${params.filePath} in ${processingTime}ms`);
      return true;
      
    } catch (error) {
      console.error(`Error processing lineage for ${params.filePath}:`, error);
      
      // Mark job as failed
      await this.failLineageJob(params.jobId, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
  
  /**
   * Get file content for lineage processing
   */
  private async getFileContent(params: ProcessLineageJobParams): Promise<string | null> {
    // If we have existing documentation with code content, use that
    if (params.existingDocumentation?.code_content) {
      return params.existingDocumentation.code_content;
    }
    
    // Otherwise, fetch from GitHub
    try {
      // Get GitHub installation for this repository
      const { data: installation, error: installError } = await supabase
        .from('github_installations')
        .select('installation_id, access_token')
        .eq('repository_full_name', params.repositoryFullName)
        .single();
        
      if (installError || !installation) {
        throw new Error('GitHub installation not found');
      }
      
      // Fetch file content from GitHub API
      const [owner, repo] = params.repositoryFullName.split('/');
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${params.filePath}`,
        {
          headers: {
            'Authorization': `token ${installation.access_token}`,
            'Accept': 'application/vnd.github.v3.raw'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      return await response.text();
      
    } catch (error) {
      console.error('Error fetching file content from GitHub:', error);
      return null;
    }
  }
  
  /**
   * Extract lineage information using LLM
   */
  private async extractLineageWithLLM(
    code: string,
    filePath: string,
    language: string
  ): Promise<LineageExtractionResult> {
    try {
      // Get appropriate prompt for the language
      const promptTemplate = getLineagePromptForLanguage(language);
      
      // Interpolate variables into the prompt
      const prompt = interpolatePrompt(promptTemplate, {
        code,
        filePath,
        language,
        context: `This is a ${language} file from a data processing pipeline.`
      });
      
      console.log(`Extracting lineage for ${filePath} using ${language} prompt`);
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert data lineage analyst. Always return valid JSON that matches the requested schema exactly.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
      
      // Parse the JSON response
      const lineageResult: LineageExtractionResult = JSON.parse(content);
      
      // Validate and enhance the result
      return this.validateAndEnhanceLineageResult(lineageResult, filePath, language);
      
    } catch (error) {
      console.error('Error extracting lineage with LLM:', error);
      
      // Return minimal result on error
      return {
        assets: [],
        relationships: [],
        fileDependencies: [],
        functions: [],
        businessContext: {
          mainPurpose: 'Analysis failed - manual review needed',
          businessImpact: 'Unknown',
          businessCriticality: 'medium'
        }
      };
    }
  }
  
  /**
   * Validate and enhance lineage extraction result
   */
  private validateAndEnhanceLineageResult(
    result: LineageExtractionResult,
    filePath: string,
    language: string
  ): LineageExtractionResult {
    // Ensure all required fields exist
    result.assets = result.assets || [];
    result.relationships = result.relationships || [];
    result.fileDependencies = result.fileDependencies || [];
    result.functions = result.functions || [];
    result.businessContext = result.businessContext || {
      mainPurpose: 'Data processing',
      businessImpact: 'Unknown',
      businessCriticality: 'medium'
    };
    
    // Enhance assets with file context
    result.assets.forEach(asset => {
      asset.metadata = asset.metadata || {};
      asset.metadata.sourceFile = filePath;
      asset.metadata.sourceLanguage = language;
      asset.metadata.extractedAt = new Date().toISOString();
    });
    
    // Validate confidence scores
    result.relationships.forEach(rel => {
      if (rel.confidenceScore < 0 || rel.confidenceScore > 1) {
        rel.confidenceScore = 0.5; // Default to medium confidence
      }
    });
    
    result.fileDependencies.forEach(dep => {
      if (dep.confidenceScore < 0 || dep.confidenceScore > 1) {
        dep.confidenceScore = 0.5;
      }
    });
    
    // Enhance functions with complexity scoring
    result.functions.forEach(func => {
      if (!func.complexityScore || func.complexityScore < 0 || func.complexityScore > 1) {
        // Simple heuristic based on parameters and description length
        const paramCount = func.parameters?.length || 0;
        const descLength = (func.description || '').length;
        func.complexityScore = Math.min(1, (paramCount * 0.1) + (descLength / 1000));
      }
    });
    
    return result;
  }
  
  /**
   * Store extracted lineage data in the database
   */
  private async storeLineageData(
    fileId: string,
    lineageResult: LineageExtractionResult
  ): Promise<void> {
    try {
      // Store discovered assets
      for (const asset of lineageResult.assets) {
        const assetId = await this.insertDataAsset(fileId, asset);
        
        // Store columns if provided
        if (asset.columns && asset.columns.length > 0) {
          await this.insertDataColumns(assetId, asset.columns);
        }
      }
      
      // Store functions
      for (const func of lineageResult.functions) {
        await this.insertCodeFunction(fileId, func);
      }
      
      // Store file dependencies
      for (const dep of lineageResult.fileDependencies) {
        await this.insertFileDependency(fileId, dep);
      }
      
      // Store relationships (requires asset resolution)
      await this.storeLineageRelationships(fileId, lineageResult.relationships);
      
      console.log(`Stored lineage data: ${lineageResult.assets.length} assets, ${lineageResult.relationships.length} relationships`);
      
    } catch (error) {
      console.error('Error storing lineage data:', error);
      throw error;
    }
  }
  
  /**
   * Insert a data asset
   */
  private async insertDataAsset(fileId: string, asset: any): Promise<string> {
    const { data, error } = await supabase
      .rpc('insert_discovered_asset', {
        p_file_id: fileId,
        p_asset_name: asset.name,
        p_asset_type: asset.type,
        p_schema_name: asset.schema,
        p_database_name: asset.database,
        p_metadata: asset.metadata || {}
      });
      
    if (error) {
      throw new Error(`Failed to insert asset: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Insert data columns for an asset
   */
  private async insertDataColumns(assetId: string, columns: any[]): Promise<void> {
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      
      const { error } = await supabase
        .from('code_insights.data_columns')
        .insert({
          asset_id: assetId,
          column_name: column.name,
          column_type: column.type,
          is_nullable: column.isNullable !== false,
          is_primary_key: column.isPrimaryKey || false,
          is_foreign_key: column.isForeignKey || false,
          foreign_key_reference: column.foreignKeyReference,
          column_description: column.description,
          ordinal_position: i + 1,
          column_metadata: column.metadata || {}
        });
        
      if (error) {
        console.error(`Error inserting column ${column.name}:`, error);
      }
    }
  }
  
  /**
   * Insert a code function
   */
  private async insertCodeFunction(fileId: string, func: any): Promise<void> {
    const { error } = await supabase
      .from('code_insights.code_functions')
      .insert({
        file_id: fileId,
        function_name: func.name,
        function_type: func.type,
        language: func.language || 'unknown',
        signature: func.signature,
        return_type: func.returnType,
        parameters: func.parameters || [],
        description: func.description,
        line_start: func.lineStart,
        line_end: func.lineEnd,
        complexity_score: func.complexityScore || 0,
        business_logic: func.businessLogic
      });
      
    if (error) {
      console.error(`Error inserting function ${func.name}:`, error);
    }
  }
  
  /**
   * Insert file dependency
   */
  private async insertFileDependency(fileId: string, dep: any): Promise<void> {
    // Try to resolve the target file ID
    const { data: targetFile } = await supabase
      .from('code_insights.files')
      .select('id')
      .eq('file_path', dep.importPath)
      .single();
      
    if (targetFile) {
      const { error } = await supabase
        .from('code_insights.file_dependencies')
        .insert({
          source_file_id: fileId,
          target_file_id: targetFile.id,
          dependency_type: dep.importType,
          import_statement: dep.importStatement,
          alias_used: dep.aliasUsed,
          specific_items: dep.specificItems || [],
          confidence_score: dep.confidenceScore
        });
        
      if (error) {
        console.error(`Error inserting file dependency:`, error);
      }
    }
  }
  
  /**
   * Store lineage relationships
   */
  private async storeLineageRelationships(
    fileId: string,
    relationships: any[]
  ): Promise<void> {
    for (const rel of relationships) {
      try {
        // Find source and target assets
        const { data: sourceAsset } = await supabase
          .from('code_insights.data_assets')
          .select('id')
          .eq('asset_name', rel.sourceAsset)
          .eq('file_id', fileId)
          .single();
          
        const { data: targetAsset } = await supabase
          .from('code_insights.data_assets')
          .select('id')
          .or(`asset_name.eq.${rel.targetAsset},full_qualified_name.eq.${rel.targetAsset}`)
          .single();
          
        if (sourceAsset && targetAsset) {
          await supabase.rpc('insert_lineage_relationship', {
            p_source_asset_id: sourceAsset.id,
            p_target_asset_id: targetAsset.id,
            p_relationship_type: rel.relationshipType,
            p_operation_type: rel.operationType,
            p_confidence_score: rel.confidenceScore,
            p_transformation_logic: rel.transformationLogic,
            p_business_context: rel.businessContext,
            p_discovered_in_file_id: fileId,
            p_discovered_at_line: rel.discoveredAtLine,
            p_join_conditions: rel.joinConditions || {},
            p_filter_conditions: rel.filterConditions || {},
            p_aggregation_logic: rel.aggregationLogic || {}
          });
        }
      } catch (error) {
        console.error(`Error storing relationship ${rel.sourceAsset} -> ${rel.targetAsset}:`, error);
      }
    }
  }
  
  /**
   * Mark lineage job as completed
   */
  private async completeLineageJob(
    jobId: string,
    lineageResult: LineageExtractionResult,
    processingTime: number
  ): Promise<void> {
    const { error } = await supabase
      .rpc('complete_lineage_processing', {
        p_job_id: jobId,
        p_dependencies_extracted: {
          fileDependencies: lineageResult.fileDependencies,
          extractedAt: new Date().toISOString()
        },
        p_assets_discovered: {
          assets: lineageResult.assets,
          functions: lineageResult.functions,
          businessContext: lineageResult.businessContext,
          extractedAt: new Date().toISOString()
        },
        p_confidence_score: this.calculateOverallConfidence(lineageResult),
        p_processing_duration_ms: processingTime
      });
      
    if (error) {
      throw new Error(`Failed to complete lineage job: ${error.message}`);
    }
  }
  
  /**
   * Mark lineage job as failed
   */
  private async failLineageJob(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await supabase
      .rpc('complete_lineage_processing', {
        p_job_id: jobId,
        p_dependencies_extracted: {},
        p_assets_discovered: {},
        p_confidence_score: 0,
        p_error_details: errorMessage
      });
      
    if (error) {
      console.error('Failed to mark lineage job as failed:', error);
    }
  }
  
  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(lineageResult: LineageExtractionResult): number {
    const allScores = [
      ...lineageResult.relationships.map(r => r.confidenceScore),
      ...lineageResult.fileDependencies.map(d => d.confidenceScore)
    ];
    
    if (allScores.length === 0) return 0.5;
    
    return allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  }
  
  /**
   * Process multiple files in batch
   */
  async processBatchLineage(jobs: ProcessLineageJobParams[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Process jobs in parallel (with concurrency limit)
    const concurrency = 3;
    const chunks = [];
    
    for (let i = 0; i < jobs.length; i += concurrency) {
      chunks.push(jobs.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(job => this.processFileLineage(job));
      const chunkResults = await Promise.allSettled(promises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.successful++;
        } else {
          results.failed++;
          const error = result.status === 'rejected' 
            ? result.reason?.message || 'Unknown error'
            : 'Processing failed';
          results.errors.push(`${chunk[index].filePath}: ${error}`);
        }
      });
    }
    
    return results;
  }
} 