import { Request, Response } from 'express';
import { supabaseCodeInsights } from '../../config/supabaseClient';
import supabaseAdmin from '../../config/supabaseClient';
import { getOctokitForUser, listAllRepoFiles } from '../../services/github.service';
import { randomUUID } from 'crypto';
import { getLineagePromptForLanguage, interpolatePrompt } from '../../prompts/lineage-prompts';

// ========================================
// PRODUCTION OPTIMIZATIONS
// ========================================

/**
 * Production Configuration for LLM Processing
 * Optimized for cost-efficiency and performance
 */
const LLM_CONFIG = {
  // Use cost-effective models for different phases
  DOCUMENTATION_MODEL: 'gpt-4.1-mini',     // Fast and cost-effective
  LINEAGE_MODEL: 'gpt-4.1-mini',           // Good balance of quality and cost
  DEPENDENCY_MODEL: 'gpt-4.1-mini',        // Complex analysis but cost-effective
  IMPACT_MODEL: 'gpt-4.1-mini',            // Most comprehensive analysis
  
  // Temperature settings for consistency
  ANALYSIS_TEMPERATURE: 0.2,              // Low for consistent analytical output
  
  // Token limits for cost control
  MAX_TOKENS: {
    LINEAGE: 3000,
    DEPENDENCY: 4000,
    IMPACT: 6000
  },
  
  // Timeout settings
  TIMEOUT: {
    DOCUMENTATION: 300000,    // 5 minutes
    VECTORS: 300000,         // 5 minutes
    LINEAGE: 600000,         // 10 minutes
    DEPENDENCY: 600000,      // 10 minutes
    IMPACT: 600000           // 10 minutes
  }
};

/**
 * Batch Processing Configuration
 * For handling large repositories efficiently
 */
const BATCH_CONFIG = {
  MAX_FILES_PER_BATCH: 50,              // Process in batches for large repos
  BATCH_DELAY: 1000,                    // 1 second delay between batches
  MAX_CONCURRENT_LLM_CALLS: 3,          // Limit concurrent LLM calls
  RETRY_ATTEMPTS: 3,                    // Retry failed operations
  RETRY_DELAY: 5000                     // 5 second delay between retries
};

/**
 * Data Optimization Configuration
 * For efficient data storage and retrieval
 */
const DATA_CONFIG = {
  SUMMARY_TRUNCATE_LENGTH: 10000,       // Truncate very long summaries
  MAX_LINEAGE_RELATIONSHIPS: 1000,      // Limit relationships per file
  CACHE_DURATION: 3600000,              // 1 hour cache for repeated analysis
  CLEANUP_OLD_DATA_DAYS: 30             // Clean up data older than 30 days
};

/**
 * ProcessingPhasesController
 * 
 * Contains clean, separate processing logic for each phase.
 * These are called by the sequential processing controller in order.
 * 
 * Each phase:
 * 1. Validates input
 * 2. Finds files ready for processing
 * 3. Updates database status
 * 4. Triggers actual processing (edge function or direct)
 * 5. Returns status
 */
export class ProcessingPhasesController {

  // ========================================
  // PHASE 1: DOCUMENTATION ANALYSIS
  // ========================================
  
  /**
   * Phase 1: Repository Scanning + Documentation Analysis
   * - Scans GitHub repository for files
   * - Creates file records and processing jobs
   * - Triggers documentation processing via edge function
   */
  static async processPhase1Documentation(req: Request, res: Response) {
    try {
      const { repositoryFullName, selectedLanguage } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!repositoryFullName || !repositoryFullName.includes('/')) {
        return res.status(400).json({ message: 'A valid repositoryFullName (e.g., "owner/repo") is required.' });
      }

      console.log(`📄 PHASE 1: Starting Documentation Analysis for ${repositoryFullName}`);
      console.log(`👤 User: ${userId}, Language: ${selectedLanguage || 'auto-detect'}`);

      // ===== STEP 1: GITHUB REPOSITORY SCANNING =====
      
      // Get GitHub connection
      const octokit = await getOctokitForUser(userId);
      if (!octokit) {
        return res.status(404).json({ message: 'GitHub connection not found for this user.' });
      }

      // Get installation ID
      const { data: installationData, error: installationError } = await supabaseAdmin
        .schema('github_module')
        .from('github_app_installations')
        .select('installation_id')
        .eq('supabase_user_id', userId)
        .single();

      if (installationError || !installationData) {
        console.error(`GitHub App installation not found for user ${userId}:`, installationError);
        return res.status(404).json({ message: 'GitHub App installation not found for your account.' });
      }

      const githubInstallationId = installationData.installation_id;
      const [owner, repo] = repositoryFullName.split('/');

      // Scan repository files
      console.log(`🔍 Scanning repository ${owner}/${repo} for files...`);
      const allFiles = await listAllRepoFiles(octokit, owner, repo);
      
      // Filter for allowed file types
      const ALLOWED_EXTENSIONS = [
        '.sql', '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h', 
        '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala', 
        '.r', '.m', '.sh', '.yml', '.yaml', '.json', '.xml', '.md'
      ];
      
      const filesToProcess = allFiles.filter((file: any) => {
        if (ALLOWED_EXTENSIONS.length === 0) return true;
        return ALLOWED_EXTENSIONS.some(ext => file.path.endsWith(ext));
      });

      if (filesToProcess.length === 0) {
        return res.status(200).json({ 
          message: 'Repository scanned. No files matching the criteria to process.',
          totalFilesScanned: allFiles.length,
          totalFilesToProcess: 0,
          phase: 'documentation'
        });
      }

      console.log(`📋 Found ${filesToProcess.length} files to process (${allFiles.length} total scanned)`);

      // ===== STEP 2: CREATE FILE RECORDS =====
      
      const getLanguageFromFilePath = (filePath: string): string => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap: { [key: string]: string } = {
          'sql': 'sql', 'py': 'python', 'js': 'javascript', 'ts': 'typescript',
          'java': 'java', 'cpp': 'cpp', 'c': 'c', 'h': 'c', 'cs': 'csharp',
          'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'kt': 'kotlin',
          'swift': 'swift', 'scala': 'scala', 'r': 'r', 'm': 'matlab',
          'sh': 'bash', 'yml': 'yaml', 'yaml': 'yaml', 'json': 'json',
          'xml': 'xml', 'md': 'markdown'
        };
        return languageMap[ext || ''] || 'unknown';
      };

      const fileRecords = filesToProcess.map((file: any) => ({
        user_id: userId,
        repository_full_name: repositoryFullName,
        file_path: file.path,
        file_hash: file.sha,
        language: getLanguageFromFilePath(file.path),
        parsing_status: 'pending',
        github_installation_id: githubInstallationId,
      }));

      console.log(`💾 Upserting ${fileRecords.length} files into database...`);
      
      const { data: upsertedFiles, error: filesError } = await supabaseCodeInsights
        .from('files')
        .upsert(fileRecords, {
          onConflict: 'repository_full_name, file_path',
          ignoreDuplicates: false,
        })
        .select();

      if (filesError) {
        console.error('Error upserting files:', filesError);
        throw new Error(`Failed to save file data: ${filesError.message}`);
      }

      console.log(`✅ Successfully upserted ${upsertedFiles?.length || 0} files`);

      // ===== STEP 3: CREATE PROCESSING JOBS =====
      
      if (upsertedFiles && upsertedFiles.length > 0) {
        // Create processing jobs for all files (upsert will handle duplicates)
        const jobRecords = upsertedFiles.map(file => ({
          file_id: file.id,
          status: 'pending', // Start with documentation pending
          vector_status: null, // Will be set later in Phase 2
          lineage_status: null, // Will be set later in Phase 3
          retry_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          analysis_language: selectedLanguage || 'default',
        }));

        console.log(`🔧 Upserting ${jobRecords.length} processing jobs for documentation...`);

        const { data: upsertedJobs, error: jobError } = await supabaseCodeInsights
          .from('processing_jobs')
          .upsert(jobRecords, {
            onConflict: 'file_id',
            ignoreDuplicates: false
          })
          .select();

        if (jobError) {
          console.error('Error upserting processing jobs:', jobError);
          throw new Error(`Failed to upsert processing jobs: ${jobError.message}`);
        }

        const newJobsCount = upsertedJobs?.length || 0;
        console.log(`✅ Successfully upserted ${newJobsCount} processing jobs (new + updated)`);
      }

      // ===== STEP 4: TRIGGER EDGE FUNCTION PROCESSING =====
      
      console.log(`📊 Documentation jobs ready - edge function will pick them up automatically`);
      console.log(`📊 Phase 1 Status: ${upsertedFiles?.length || 0} files total for documentation analysis`);

      return res.status(202).json({
        message: 'Phase 1: Documentation analysis initiated successfully',
        totalFilesScanned: allFiles.length,
        filesQueued: upsertedFiles?.length || 0, // Total files ready for processing (new + existing)
        phase: 'documentation',
        nextPhase: 'vectors',
        status: 'processing'
      });

    } catch (error: any) {
      console.error(`❌ Error in Phase 1 Documentation:`, error);
      return res.status(500).json({ 
        error: 'Phase 1 documentation processing failed', 
        details: error.message 
      });
    }
  }

  // ========================================
  // PHASE 2: VECTOR GENERATION
  // ========================================
  
  /**
   * Phase 2: Vector Generation
   * - Finds files with completed documentation
   * - Enables vector processing for those files
   * - Triggers vector generation via edge function
   */
  static async processPhase2Vectors(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!repositoryFullName || !repositoryFullName.includes('/')) {
        return res.status(400).json({ message: 'A valid repositoryFullName is required.' });
      }

      console.log(`🔍 PHASE 2: Starting Vector Generation for ${repositoryFullName}`);

      // ===== STEP 1: FIND FILES READY FOR VECTORS =====
      
      const { data: completedDocs, error: findError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .eq('status', 'completed') // Documentation must be completed
        .is('vector_status', null); // No vector processing yet

      if (findError) {
        console.error('Error finding completed documentation files:', findError);
        throw new Error(`Failed to find files ready for vector processing: ${findError.message}`);
      }

      console.log(`🔍 Found ${completedDocs?.length || 0} files with completed documentation`);

      if (!completedDocs || completedDocs.length === 0) {
        return res.status(200).json({
          message: 'No files found with completed documentation ready for vector processing',
          filesQueued: 0,
          phase: 'vectors',
          status: 'completed' // If no files need vectors, phase is complete
        });
      }

      // ===== STEP 2: ENABLE VECTOR PROCESSING =====
      
      const jobIds = completedDocs.map(job => job.id);
      
      console.log(`🔧 Enabling vector processing for ${jobIds.length} jobs...`);
      
      const { error: updateError } = await supabaseCodeInsights
        .from('processing_jobs')
        .update({
          vector_status: 'pending',
          leased_at: null, // Ensure not leased
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (updateError) {
        console.error('Error enabling vector processing:', updateError);
        throw new Error(`Failed to enable vector processing: ${updateError.message}`);
      }

      console.log(`✅ Successfully enabled vector processing for ${completedDocs.length} files`);
      console.log(`🚀 Vector jobs ready - edge function will pick them up automatically`);

      return res.status(202).json({
        message: 'Phase 2: Vector generation initiated successfully',
        filesQueued: completedDocs.length,
        phase: 'vectors',
        nextPhase: 'lineage',
        status: 'processing'
      });

    } catch (error: any) {
      console.error(`❌ Error in Phase 2 Vectors:`, error);
      return res.status(500).json({ 
        error: 'Phase 2 vector processing failed', 
        details: error.message 
      });
    }
  }

  // ========================================
  // PHASE 3: LINEAGE EXTRACTION (LLM-ASSISTED)
  // ========================================
  
  /**
   * Phase 3: Lineage Extraction
   * - Uses existing code summaries (no duplicate code analysis)
   * - Calls LLM specifically for lineage extraction from summaries
   * - Stores results in lineage tables
   */
  static async processPhase3Lineage(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!repositoryFullName || !repositoryFullName.includes('/')) {
        return res.status(400).json({ message: 'A valid repositoryFullName is required.' });
      }

      console.log(`🔗 PHASE 3: Starting Lineage Extraction for ${repositoryFullName}`);

      // ===== STEP 1: GET EXISTING CODE SUMMARIES =====
      
      const { data: codeSummaries, error: summariesError } = await supabaseCodeInsights
        .from('code_summaries')
        .select(`
          id,
          file_id,
          summary_json,
          files!inner(id, language, repository_full_name, user_id, file_path)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId);

      if (summariesError) {
        console.error('Error fetching code summaries:', summariesError);
        throw new Error(`Failed to fetch code summaries: ${summariesError.message}`);
      }

      console.log(`📄 Found ${codeSummaries?.length || 0} code summaries`);

      if (!codeSummaries || codeSummaries.length === 0) {
        return res.status(200).json({
          message: 'No code summaries found - Phase 1 must be completed first',
          filesProcessed: 0,
          phase: 'lineage',
          status: 'completed'
        });
      }

      // ===== STEP 2: FILTER FOR DATA-RELEVANT FILES =====
      
      const dataFiles = codeSummaries.filter(summary => {
        const language = (summary as any).files.language?.toLowerCase() || '';
        const filePath = (summary as any).files.file_path?.toLowerCase() || '';
        const summaryJson = summary.summary_json;
        
        // Include files that are data-related OR have data flow information
        return language.includes('sql') || 
               language.includes('postgres') ||
               language.includes('mysql') ||
               language.includes('snowflake') ||
               language.includes('bigquery') ||
               language.includes('redshift') ||
               language.includes('dbt') ||
               language.includes('python') ||
               language.includes('scala') ||
               language.includes('spark') ||
               filePath.endsWith('.sql') ||
               filePath.includes('dbt') ||
               filePath.includes('transform') ||
               filePath.includes('etl') ||
               filePath.includes('pipeline') ||
               // Include files with data flow info in summary
               (summaryJson?.technical_details?.data_flow && summaryJson.technical_details.data_flow.length > 0) ||
               (summaryJson?.technical_details?.tables_accessed && summaryJson.technical_details.tables_accessed.length > 0) ||
               (summaryJson?.technical_details?.external_dependencies && summaryJson.technical_details.external_dependencies.length > 0);
      });

      console.log(`🗄️ Found ${dataFiles.length} data-relevant files for lineage processing`);

      if (dataFiles.length === 0) {
        return res.status(200).json({
          message: 'No data-relevant files found for lineage processing',
          filesProcessed: 0,
          totalFilesChecked: codeSummaries.length,
          phase: 'lineage',
          status: 'completed'
        });
      }

      // ===== STEP 3: PROCESS FILES IN BATCHES =====
      
      let totalFilesProcessed = 0;
      let totalAssetsExtracted = 0;
      let totalRelationshipsExtracted = 0;
      let totalFileDependenciesExtracted = 0;
      const batchSize = 5; // Process 5 files at a time to avoid overwhelming the system

      for (let i = 0; i < dataFiles.length; i += batchSize) {
        const batch = dataFiles.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(dataFiles.length/batchSize)} (${batch.length} files)`);

        // Create processing jobs for this batch
        const jobRecords = batch.map(summary => ({
          file_id: summary.file_id,
          status: 'completed', // Documentation already completed
          vector_status: 'completed', // Vectors already completed
          lineage_status: 'pending', // Now processing lineage
          retry_count: 0,
          updated_at: new Date().toISOString()
        }));

        // Update processing jobs to indicate lineage processing
        const { error: updateError } = await supabaseCodeInsights
          .from('processing_jobs')
          .upsert(jobRecords, { onConflict: 'file_id' });

        if (updateError) {
          console.error('Error updating processing jobs:', updateError);
          continue; // Skip this batch but continue with others
        }

        // Process each file in the batch
        for (const summary of batch) {
          try {
            console.log(`🔍 Processing lineage for: ${(summary as any).files.file_path}`);
            
            // Extract lineage using LLM (but only for lineage, not re-analyzing the code)
            const lineageResults = await this.extractLineageFromSummaryWithLLM(
              summary.summary_json,
              (summary as any).files.file_path,
              (summary as any).files.language,
              repositoryFullName
            );

            if (lineageResults) {
              // Store assets
              if (lineageResults.assets && lineageResults.assets.length > 0) {
                                 const assetsWithIds = lineageResults.assets.map((asset: any) => ({
                  ...asset,
                  id: randomUUID(),
                  file_id: summary.file_id,
                  repository_full_name: repositoryFullName
                }));

                const { error: assetsError } = await supabaseCodeInsights
                  .from('data_assets')
                  .upsert(assetsWithIds, { onConflict: 'file_id,name' });

                if (!assetsError) {
                  totalAssetsExtracted += assetsWithIds.length;
                  console.log(`✅ Stored ${assetsWithIds.length} assets for ${(summary as any).files.file_path}`);
                }
              }

              // Store relationships
              if (lineageResults.relationships && lineageResults.relationships.length > 0) {
                const relationshipsWithIds = await this.resolveAssetIds(lineageResults.relationships, repositoryFullName);
                
                if (relationshipsWithIds.length > 0) {
                  const { error: relationshipsError } = await supabaseCodeInsights
                    .from('data_lineage')
                    .upsert(relationshipsWithIds, { 
                      onConflict: 'source_asset_id,target_asset_id,relationship_type,discovered_in_file_id' 
                    });

                  if (!relationshipsError) {
                    totalRelationshipsExtracted += relationshipsWithIds.length;
                    console.log(`✅ Stored ${relationshipsWithIds.length} relationships for ${(summary as any).files.file_path}`);
                  }
                }
              }

              // Store file dependencies
              if (lineageResults.fileDependencies && lineageResults.fileDependencies.length > 0) {
                const fileDepsWithIds = await this.resolveFileDependencyIds(lineageResults.fileDependencies, repositoryFullName, userId);
                
                if (fileDepsWithIds.length > 0) {
                  const { error: fileDepsError } = await supabaseCodeInsights
                    .from('file_dependencies')
                    .upsert(fileDepsWithIds, { 
                      onConflict: 'source_file_id,target_file_id,dependency_type' 
                    });

                  if (!fileDepsError) {
                    totalFileDependenciesExtracted += fileDepsWithIds.length;
                    console.log(`✅ Stored ${fileDepsWithIds.length} file dependencies for ${(summary as any).files.file_path}`);
                  }
                }
              }
            }

            // Update processing job status
            await supabaseCodeInsights
              .from('processing_jobs')
              .update({ 
                lineage_status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('file_id', summary.file_id);

            totalFilesProcessed++;

          } catch (fileError) {
            console.error(`Error processing lineage for ${(summary as any).files.file_path}:`, fileError);
            
            // Mark as failed
            await supabaseCodeInsights
              .from('processing_jobs')
              .update({ 
                lineage_status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('file_id', summary.file_id);
          }
        }

        // Small delay between batches to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ Lineage processing completed:`);
      console.log(`   📁 ${totalFilesProcessed} files processed`);
      console.log(`   📊 ${totalAssetsExtracted} data assets extracted`);
      console.log(`   🔗 ${totalRelationshipsExtracted} relationships mapped`);
      console.log(`   📁 ${totalFileDependenciesExtracted} file dependencies identified`);

      return res.status(200).json({
        message: `Phase 3: Lineage extraction completed successfully`,
        results: {
          filesProcessed: totalFilesProcessed,
          assetsExtracted: totalAssetsExtracted,
          relationshipsMapped: totalRelationshipsExtracted,
          fileDependencies: totalFileDependenciesExtracted
        },
        phase: 'lineage',
        nextPhase: 'dependencies',
        status: 'completed'
      });

    } catch (error: any) {
      console.error(`❌ Error in Phase 3 Lineage:`, error);
      return res.status(500).json({ 
        error: 'Phase 3 lineage processing failed', 
        details: error.message 
      });
    }
  }

  // ===== LLM-ASSISTED LINEAGE EXTRACTION =====

  private static async extractLineageFromSummaryWithLLM(
    summaryJson: any, 
    filePath: string, 
    language: string, 
    repositoryFullName: string
  ): Promise<any> {
    try {
      // Create a comprehensive language-specific prompt for lineage extraction from code summary
      const lineagePrompt = this.createLineagePromptFromSummary(summaryJson, filePath, language, repositoryFullName);

      // Call LLM for lineage extraction
      const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use cost-effective model for structured extraction
          messages: [
            {
              role: 'system',
              content: this.getSystemPromptForLanguage(language)
            },
            {
              role: 'user',
              content: lineagePrompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent structured output
          max_tokens: 3000 // Increased for comprehensive output
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      // Parse JSON response
      let lineageResults;
      try {
        lineageResults = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content);
        throw new Error('Invalid JSON response from LLM');
      }
      
      // Validate and normalize structure
      if (!lineageResults.assets) lineageResults.assets = [];
      if (!lineageResults.relationships) lineageResults.relationships = [];
      if (!lineageResults.fileDependencies) lineageResults.fileDependencies = [];

      // Convert to our expected format
      return this.normalizeLineageResults(lineageResults, filePath);

    } catch (error) {
      console.error(`Error extracting lineage with LLM for ${filePath}:`, error);
      return null;
    }
  }

  private static getSystemPromptForLanguage(language: string): string {
    const languageLower = language.toLowerCase();
    
    if (languageLower.includes('sql') || languageLower.includes('postgres') || 
        languageLower.includes('mysql') || languageLower.includes('snowflake') ||
        languageLower.includes('bigquery') || languageLower.includes('redshift')) {
      return 'You are an expert SQL data lineage analyst. Extract comprehensive data lineage from code summaries with high precision. Focus on tables, views, joins, transformations, and data flow patterns.';
    }
    
    if (languageLower.includes('python') || languageLower.includes('spark') || languageLower.includes('pyspark')) {
      return 'You are an expert Python/PySpark data lineage analyst. Extract comprehensive data lineage from code summaries, focusing on DataFrames, data transformations, file I/O, and data pipeline patterns.';
    }
    
    if (languageLower.includes('dbt')) {
      return 'You are an expert dbt data lineage analyst. Extract comprehensive data lineage from code summaries, focusing on dbt models, sources, macros, tests, and dependencies.';
    }
    
    if (languageLower.includes('scala')) {
      return 'You are an expert Scala/Spark data lineage analyst. Extract comprehensive data lineage from code summaries, focusing on DataFrames, RDDs, data transformations, and Spark operations.';
    }

    return 'You are an expert data lineage analyst. Extract comprehensive data lineage from code summaries, focusing on data assets, transformations, and dependencies regardless of technology stack.';
  }

  private static createLineagePromptFromSummary(
    summaryJson: any,
    filePath: string,
    language: string,
    repositoryFullName: string
  ): string {
    const languageLower = language.toLowerCase();
    
    // Extract relevant information from the summary
    const technicalDetails = summaryJson?.technical_details || {};
    const businessLogic = summaryJson?.business_logic || {};
    const bestPractices = summaryJson?.best_practices || {};

    let languageSpecificInstructions = '';
    
    // Add language-specific extraction patterns
    if (languageLower.includes('sql') || languageLower.includes('postgres') || 
        languageLower.includes('mysql') || languageLower.includes('tsql') || 
        languageLower.includes('plsql')) {
      languageSpecificInstructions = `
**SQL-SPECIFIC PATTERNS TO EXTRACT:**
- Tables: FROM, JOIN, INSERT INTO, UPDATE, DELETE FROM clauses
- Views: CREATE VIEW statements
- CTEs: WITH clause common table expressions
- Stored procedures and functions
- Triggers and constraints
- Schema and database references
- Window functions and partitioning
- Aggregations: GROUP BY, HAVING, aggregate functions
- Joins: INNER, LEFT, RIGHT, FULL OUTER joins with conditions
- Subqueries and derived tables
- Data types and column constraints
- Indexes and performance optimizations`;
    }
    
    else if (languageLower.includes('sparksql') || languageLower.includes('spark-sql')) {
      languageSpecificInstructions = `
**SPARK SQL-SPECIFIC PATTERNS TO EXTRACT:**
- Tables: Hive tables, Delta tables, Parquet files
- Temporary views: CREATE TEMPORARY VIEW statements
- Complex data types: arrays, structs, maps
- Window functions with PARTITION BY and ORDER BY
- Delta operations: MERGE, DELETE, UPDATE with Delta Lake
- File formats: Parquet, Delta, JSON, CSV, Avro
- Streaming sources: structured streaming operations
- UDFs: User-defined functions in Spark SQL
- Broadcast joins and optimization hints
- Partition strategies and bucketing
- Catalog operations: CREATE DATABASE, USE DATABASE`;
    }
    
    else if (languageLower.includes('python') || languageLower.includes('pyspark')) {
      languageSpecificInstructions = `
**PYTHON/PYSPARK-SPECIFIC PATTERNS TO EXTRACT:**
- DataFrames: pandas.DataFrame, spark.DataFrame operations
- File I/O: read_csv, read_parquet, read_sql, to_csv, to_parquet
- Database connections: sqlalchemy, psycopg2, pymongo, spark.read.jdbc
- Data transformations: merge, join, groupby, agg, apply, select, filter
- Spark operations: select, filter, groupBy, join, union, withColumn
- Data sources: files, databases, APIs, streaming sources
- ML pipelines: feature engineering, model training data flows
- Spark SQL embedded in Python: spark.sql() calls
- Data quality: validation, cleansing, deduplication logic
- Performance: caching, partitioning, broadcast variables`;
    }
    
    else if (languageLower.includes('dbt')) {
      languageSpecificInstructions = `
**DBT-SPECIFIC PATTERNS TO EXTRACT:**
- Models: {{ ref('model_name') }} references
- Sources: {{ source('schema', 'table') }} references  
- Macros: {{ macro_name() }} usage
- Tests: data quality and relationship tests
- Seeds: CSV data references
- Snapshots: SCD implementations
- Materializations: table, view, incremental, ephemeral
- Jinja templating and variables
- Pre/post hooks and operations
- Package dependencies and imports
- Model configurations and tags`;
    }
    
    else if (languageLower.includes('scala')) {
      languageSpecificInstructions = `
**SCALA/SPARK-SPECIFIC PATTERNS TO EXTRACT:**
- DataFrames and Datasets operations
- RDD transformations and actions
- Spark SQL operations
- Data sources: JDBC, Parquet, Delta, Hive
- Transformations: select, filter, join, groupBy, agg
- UDFs and custom functions
- Streaming data sources and sinks
- Case classes and schema definitions
- Catalyst optimizations and custom rules`;
    }

    return `
You are an expert data lineage analyst for ${language} code. Extract comprehensive data lineage information from this CODE SUMMARY (not raw code).

**CONTEXT:**
- File: ${filePath}
- Language: ${language}
- Repository: ${repositoryFullName}

**CODE SUMMARY TO ANALYZE:**
${JSON.stringify(summaryJson, null, 2)}

${languageSpecificInstructions}

**EXTRACT THE FOLLOWING (return as valid JSON only):**

{
  "assets": [
    {
      "name": "asset_name",
      "asset_type": "table|view|function|dataset|model|source|file",
      "full_qualified_name": "schema.table_name or full path",
      "description": "business purpose from summary",
      "schema_name": "schema if applicable",
      "database_name": "database if applicable",
      "metadata": {
        "source": "code_summary",
        "confidence": 0.8,
        "materialization": "table|view|incremental",
        "technology": "${language}",
        "data_format": "parquet|delta|csv|json|hive",
        "partition_keys": ["partition_columns"],
        "business_domain": "finance|customer|product|operations"
      }
    }
  ],
  "relationships": [
    {
      "source_asset_name": "source_table",
      "target_asset_name": "target_table",
      "relationship_type": "reads_from|writes_to|transforms|joins|aggregates|unions|filters",
      "operation_type": "select|insert|update|delete|merge|create_table_as",
      "transformation_logic": "detailed transformation description from summary",
      "business_context": "business purpose from summary",
      "confidence_score": 0.8,
      "execution_frequency": "adhoc|daily|hourly|realtime|weekly|monthly",
      "data_volume": "small|medium|large|big_data",
      "business_criticality": "critical|high|medium|low",
      "discovered_in_file_id": "${filePath}"
    }
  ],
  "fileDependencies": [
    {
      "target_file_path": "path/to/dependency",
      "dependency_type": "imports|references|executes|includes",
      "import_statement": "actual import or reference statement",
      "confidence_score": 0.8
    }
  ]
}

**EXTRACTION GUIDELINES:**
1. **Focus on the SUMMARY content** - don't invent details not in the summary
2. **Extract from technical_details section** - tables_accessed, functions_called, data_flow, dependencies
3. **Use business_logic section** - for business context and transformation purposes
4. **Assign confidence scores** based on clarity in the summary (0.6-0.95)
5. **Fully qualify asset names** when schema/database info is available
6. **Include transformation logic** from the summary's technical details
7. **Map business context** from the summary's business logic section
8. **Extract file dependencies** from external_dependencies or imports in summary
9. **Consider data processing patterns** specific to ${language}
10. **Include performance and optimization context** from the summary

**IMPORTANT:** 
- Only extract information that's actually present in the code summary
- Don't hallucinate assets or relationships not mentioned
- Use the summary's technical_details and business_logic sections as primary sources
- Return ONLY valid JSON, no additional text or explanations
- Focus on data lineage, not general code dependencies

**RETURN VALID JSON:**`;
  }

  private static normalizeLineageResults(lineageResults: any, filePath: string): any {
    // Convert the LLM response format to our database format
    const normalized = {
      assets: [],
      relationships: [],
      fileDependencies: []
    };

    // Normalize assets
    if (lineageResults.assets && Array.isArray(lineageResults.assets)) {
      normalized.assets = lineageResults.assets.map((asset: any) => ({
        name: asset.name,
        asset_type: asset.asset_type || asset.type || 'table',
        full_qualified_name: asset.full_qualified_name || asset.name,
        description: asset.description || '',
        schema_name: asset.schema_name || asset.schema,
        database_name: asset.database_name || asset.database,
        metadata: asset.metadata || { source: 'code_summary', confidence: 0.8 }
      }));
    }

    // Normalize relationships
    if (lineageResults.relationships && Array.isArray(lineageResults.relationships)) {
      normalized.relationships = lineageResults.relationships.map((rel: any) => ({
        source_asset_name: rel.source_asset_name || rel.sourceAsset,
        target_asset_name: rel.target_asset_name || rel.targetAsset,
        relationship_type: rel.relationship_type || rel.relationshipType || 'transforms',
        operation_type: (rel.operation_type || rel.operationType || 'select').toLowerCase(),
        transformation_logic: rel.transformation_logic || rel.transformationLogic || '',
        business_context: rel.business_context || rel.businessContext || '',
        confidence_score: rel.confidence_score || rel.confidenceScore || 0.8,
        execution_frequency: rel.execution_frequency || rel.executionFrequency || 'adhoc',
        discovered_in_file_id: filePath
      }));
    }

    // Normalize file dependencies
    if (lineageResults.fileDependencies && Array.isArray(lineageResults.fileDependencies)) {
      normalized.fileDependencies = lineageResults.fileDependencies.map((dep: any) => ({
        target_file_path: dep.target_file_path || dep.importPath || dep.path,
        dependency_type: dep.dependency_type || dep.importType || 'references',
        import_statement: dep.import_statement || dep.importStatement || '',
        confidence_score: dep.confidence_score || dep.confidenceScore || 0.8
      }));
    }

    return normalized;
  }

  // ========================================
  // PHASE 4: DEPENDENCY ANALYSIS (LLM-ENHANCED)
  // ========================================
  
  /**
   * Phase 4: Dependency Analysis
   * - Uses stored lineage data from Phase 3
   * - Calls LLM for intelligent dependency analysis and impact assessment
   * - Creates comprehensive dependency graph with business context
   * - Stores results in dependency analysis tables
   */
  static async processPhase4Dependencies(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!repositoryFullName || !repositoryFullName.includes('/')) {
        return res.status(400).json({ message: 'A valid repositoryFullName is required.' });
      }

      console.log(`🔗 PHASE 4: Starting LLM-Enhanced Dependency Analysis for ${repositoryFullName}`);

      // ===== STEP 1: GATHER ALL LINEAGE DATA =====
      
      // Get data assets for this repository
      const { data: repositoryAssets, error: assetsError } = await supabaseCodeInsights
        .from('data_assets')
        .select('*')
        .eq('repository_full_name', repositoryFullName);

      if (assetsError) {
        console.error('Error fetching repository assets:', assetsError);
        throw new Error('Failed to fetch repository assets for dependency analysis');
      }

      // Get lineage relationships
      const assetIds = repositoryAssets?.map(asset => asset.id) || [];
      const { data: dataLineage, error: lineageError } = await supabaseCodeInsights
        .from('data_lineage')
        .select('*')
        .or(`source_asset_id.in.(${assetIds.join(',')}),target_asset_id.in.(${assetIds.join(',')})`);

      // Get file dependencies
      const { data: repositoryFiles, error: filesError } = await supabaseCodeInsights
        .from('files')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      if (filesError) {
        console.error('Error fetching repository files:', filesError);
        throw new Error('Failed to fetch repository files for dependency analysis');
      }

      const fileIds = repositoryFiles?.map(file => file.id) || [];
      const { data: fileDependencies, error: depsError } = await supabaseCodeInsights
        .from('file_dependencies')
        .select('*')
        .or(`source_file_id.in.(${fileIds.join(',')}),target_file_id.in.(${fileIds.join(',')})`);

      // Get code summaries for business context
      const { data: codeSummaries, error: summariesError } = await supabaseCodeInsights
        .from('code_summaries')
        .select(`
          id,
          file_id,
          summary_json,
          files!inner(id, language, repository_full_name, user_id, file_path)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId);

      if (lineageError || depsError || summariesError) {
        console.error('Error fetching lineage data:', { lineageError, depsError, summariesError });
        throw new Error('Failed to fetch lineage data for dependency analysis');
      }

      console.log(`📊 Gathered data: ${repositoryAssets?.length || 0} assets, ${dataLineage?.length || 0} lineage relationships, ${fileDependencies?.length || 0} file dependencies, ${codeSummaries?.length || 0} summaries`);

      if (!repositoryAssets?.length && !dataLineage?.length && !fileDependencies?.length) {
        return res.status(200).json({
          message: 'No lineage data found - Phase 3 must be completed first',
          results: {
            totalNodes: 0,
            totalEdges: 0,
            crossFileDependencies: 0,
            riskAssessment: { riskScore: 0, criticalDependencies: 0 }
          },
          phase: 'dependencies',
          nextPhase: 'analysis',
          status: 'completed'
        });
      }

      // ===== STEP 2: LLM-ENHANCED DEPENDENCY ANALYSIS =====
      
      const dependencyAnalysisResults = await this.analyzeDependenciesWithLLM(
        repositoryAssets || [],
        dataLineage || [],
        fileDependencies || [],
        codeSummaries || [],
        repositoryFiles || [],
        repositoryFullName
      );

      if (!dependencyAnalysisResults) {
        throw new Error('Failed to analyze dependencies with LLM');
      }

      // ===== STEP 3: STORE DEPENDENCY ANALYSIS =====
      
      const analysisResult = {
        repository_full_name: repositoryFullName,
        user_id: userId,
        analysis_type: 'cross_file_dependencies',
        dependency_graph: dependencyAnalysisResults.dependencyGraph,
        risk_assessment: dependencyAnalysisResults.riskAssessment,
        business_impact_analysis: dependencyAnalysisResults.businessImpactAnalysis,
        critical_paths: dependencyAnalysisResults.criticalPaths,
        recommendations: dependencyAnalysisResults.recommendations,
        total_nodes: dependencyAnalysisResults.dependencyGraph.nodes.length,
        total_edges: dependencyAnalysisResults.dependencyGraph.edges.length,
        cross_file_dependencies: dependencyAnalysisResults.dependencyGraph.crossFileConnections.length,
        analysis_date: new Date().toISOString(),
        status: 'completed'
      };

      const { error: storeError } = await supabaseCodeInsights
        .from('repository_dependency_analysis')
        .upsert([analysisResult], {
          onConflict: 'repository_full_name,user_id,analysis_type'
        });

      if (storeError) {
        console.error('Error storing dependency analysis:', storeError);
        throw new Error(`Failed to store dependency analysis: ${storeError.message}`);
      }

      console.log(`✅ Successfully completed LLM-enhanced dependency analysis`);
      console.log(`📊 Results: ${dependencyAnalysisResults.dependencyGraph.nodes.length} nodes, ${dependencyAnalysisResults.dependencyGraph.edges.length} edges`);
      console.log(`⚠️ Risk Score: ${dependencyAnalysisResults.riskAssessment.riskScore}%, Critical Dependencies: ${dependencyAnalysisResults.riskAssessment.criticalDependencies}`);

      return res.status(200).json({
        message: 'Phase 4: LLM-enhanced dependency analysis completed successfully',
        results: {
          totalNodes: dependencyAnalysisResults.dependencyGraph.nodes.length,
          totalEdges: dependencyAnalysisResults.dependencyGraph.edges.length,
          crossFileDependencies: dependencyAnalysisResults.dependencyGraph.crossFileConnections.length,
          riskScore: dependencyAnalysisResults.riskAssessment.riskScore,
          criticalDependencies: dependencyAnalysisResults.riskAssessment.criticalDependencies,
          businessImpactAreas: dependencyAnalysisResults.businessImpactAnalysis.impactAreas.length
        },
        phase: 'dependencies',
        nextPhase: 'analysis',
        status: 'completed'
      });

    } catch (error: any) {
      console.error(`❌ Error in Phase 4 Dependencies:`, error);
      return res.status(500).json({ 
        error: 'Phase 4 dependency analysis failed', 
        details: error.message 
      });
    }
  }

  // ===== LLM-ENHANCED DEPENDENCY ANALYSIS =====

  private static async analyzeDependenciesWithLLM(
    assets: any[],
    lineageRelationships: any[],
    fileDependencies: any[],
    codeSummaries: any[],
    files: any[],
    repositoryFullName: string
  ): Promise<any> {
    try {
      // Create comprehensive dependency analysis prompt
      const dependencyPrompt = this.createDependencyAnalysisPrompt(
        assets,
        lineageRelationships,
        fileDependencies,
        codeSummaries,
        files,
        repositoryFullName
      );

      // Call LLM for dependency analysis
      const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use cost-effective model for analysis
          messages: [
            {
              role: 'system',
              content: 'You are an expert data architecture and dependency analysis specialist. Analyze complex data dependencies and provide comprehensive risk assessment and business impact analysis. Return only valid JSON responses.'
            },
            {
              role: 'user',
              content: dependencyPrompt
            }
          ],
          temperature: 0.2, // Low temperature for consistent analytical output
          max_tokens: 4000 // Increased for comprehensive analysis
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      // Parse JSON response
      let dependencyResults;
      try {
        dependencyResults = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM dependency analysis response:', content);
        throw new Error('Invalid JSON response from LLM');
      }

      // Validate and normalize structure
      return this.normalizeDependencyResults(dependencyResults);

    } catch (error) {
      console.error('Error analyzing dependencies with LLM:', error);
      return null;
    }
  }

  private static createDependencyAnalysisPrompt(
    assets: any[],
    lineageRelationships: any[],
    fileDependencies: any[],
    codeSummaries: any[],
    files: any[],
    repositoryFullName: string
  ): string {
    // Create file mapping for context
    const fileMap = new Map();
    files.forEach(file => {
      fileMap.set(file.id, file);
    });

    // Create summary mapping for business context
    const summaryMap = new Map();
    codeSummaries.forEach(summary => {
      summaryMap.set(summary.file_id, summary);
    });

    // Analyze the technology stack
    const technologies = new Set();
    files.forEach(file => {
      const lang = file.language?.toLowerCase() || '';
      if (lang.includes('sql') || lang.includes('postgres') || lang.includes('mysql') || 
          lang.includes('tsql') || lang.includes('plsql')) {
        technologies.add('SQL');
      }
      if (lang.includes('spark') || lang.includes('pyspark') || lang.includes('scala')) {
        technologies.add('Spark');
      }
      if (lang.includes('python')) {
        technologies.add('Python');
      }
      if (lang.includes('dbt')) {
        technologies.add('dbt');
      }
    });

    const techStack = Array.from(technologies).join(', ');

    return `
You are an expert data architecture analyst specializing in data processing pipelines, ETL/ELT workflows, and data platform dependencies.

**REPOSITORY:** ${repositoryFullName}
**TECHNOLOGY STACK:** ${techStack}

**DATA TO ANALYZE:**

**DATA ASSETS (${assets.length}):**
${JSON.stringify(assets.slice(0, 20), null, 2)} ${assets.length > 20 ? `... and ${assets.length - 20} more assets` : ''}

**LINEAGE RELATIONSHIPS (${lineageRelationships.length}):**
${JSON.stringify(lineageRelationships.slice(0, 15), null, 2)} ${lineageRelationships.length > 15 ? `... and ${lineageRelationships.length - 15} more relationships` : ''}

**FILE DEPENDENCIES (${fileDependencies.length}):**
${JSON.stringify(fileDependencies.slice(0, 10), null, 2)} ${fileDependencies.length > 10 ? `... and ${fileDependencies.length - 10} more dependencies` : ''}

**CODE SUMMARIES FOR BUSINESS CONTEXT:**
${JSON.stringify(codeSummaries.slice(0, 8), null, 2)} ${codeSummaries.length > 8 ? `... and ${codeSummaries.length - 8} more summaries` : ''}

**REPOSITORY FILES:**
${JSON.stringify(files.map(f => ({ id: f.id, path: f.file_path, language: f.language })).slice(0, 15), null, 2)} ${files.length > 15 ? `... and ${files.length - 15} more files` : ''}

**ANALYZE AND RETURN (valid JSON only):**

{
  "dependencyGraph": {
    "nodes": [
      {
        "id": "unique_node_id",
        "name": "asset_or_file_name",
        "type": "source_table|target_table|etl_script|data_pipeline|dbt_model|spark_job",
        "technology": "sql|python|dbt|spark|pyspark",
        "businessCriticality": "critical|high|medium|low",
        "dataVolume": "small|medium|large|big_data",
        "updateFrequency": "realtime|hourly|daily|weekly|monthly|adhoc",
        "complexityScore": 0.8,
        "metadata": {
          "businessDomain": "finance|customer|product|operations|marketing",
          "dataQuality": "high|medium|low",
          "performanceImpact": "high|medium|low"
        }
      }
    ],
    "edges": [
      {
        "source": "source_node_id",
        "target": "target_node_id",
        "relationshipType": "data_flow|transformation|aggregation|join|dependency",
        "dataVolume": "small|medium|large|big_data",
        "latency": "realtime|near_realtime|batch|scheduled",
        "businessImpact": "critical|high|medium|low",
        "riskLevel": "critical|high|medium|low",
        "transformationComplexity": 0.7,
        "dataQualityImpact": "improves|maintains|degrades|unknown"
      }
    ],
    "dataFlows": [
      {
        "flowName": "Customer Analytics Pipeline",
        "sourceSystem": "Operational Database",
        "targetSystem": "Analytics Warehouse",
        "pipeline": ["raw_data", "staging_layer", "business_logic", "reporting_layer"],
        "businessPurpose": "Customer behavior analysis and reporting",
        "criticality": "high",
        "latency": "daily",
        "dataVolume": "large"
      }
    ],
    "criticalPaths": [
      {
        "path": ["source_table", "etl_process", "staging_table", "business_logic", "reporting_table"],
        "businessPurpose": "End-to-end revenue reporting pipeline",
        "riskAssessment": "Impact on financial reporting if broken",
        "stakeholders": ["Finance Team", "Executive Dashboard"],
        "sla": "Daily by 8 AM",
        "recoveryTime": "4 hours"
      }
    ]
  },
  "dataArchitectureAssessment": {
    "architecturePattern": "lambda|kappa|batch|streaming|medallion|data_mesh",
    "dataQualityScore": 85,
    "performanceScore": 75,
    "maintainabilityScore": 80,
    "scalabilityAssessment": {
      "currentScale": "medium",
      "scalabilityBottlenecks": ["Large table joins", "Single-threaded processing"],
      "recommendations": ["Implement partitioning", "Add parallel processing"]
    }
  },
  "riskAssessment": {
    "overallRiskScore": 75,
    "criticalDependencies": 5,
    "dataQualityRisks": [
      {
        "risk": "Missing data validation in ETL pipeline",
        "severity": "high",
        "affectedAssets": ["customer_table", "revenue_calculations"],
        "mitigation": "Implement data quality checks and monitoring"
      }
    ],
    "performanceRisks": [
      {
        "risk": "Cartesian product in customer-order join",
        "severity": "medium",
        "impact": "Query timeout and resource consumption",
        "mitigation": "Add proper join conditions and indexing"
      }
    ],
    "businessRisks": [
      {
        "risk": "Single point of failure in revenue pipeline",
        "severity": "critical",
        "businessImpact": "Financial reporting delays",
        "mitigation": "Implement backup processing path"
      }
    ]
  },
  "businessImpactAnalysis": {
    "dataProducts": [
      {
        "name": "Customer 360 Dashboard",
        "dependentAssets": ["customer_dim", "transaction_fact", "behavior_metrics"],
        "businessValue": "Customer insights and retention strategies",
        "stakeholders": ["Marketing", "Customer Success"],
        "impactLevel": "high"
      }
    ],
    "changeImpactRadius": {
      "coreAssets": ["customer_table", "order_table"],
      "immediateImpact": 8,
      "secondaryImpact": 15,
      "cascadingEffects": "Changes to core customer data affect all downstream analytics and reporting",
      "businessProcesses": ["Customer onboarding", "Revenue reporting", "Marketing campaigns"]
    }
  },
  "dataGovernanceInsights": {
    "dataLineageComplexity": "high|medium|low",
    "dataOwnership": [
      {
        "asset": "customer_data",
        "owner": "Customer Success Team",
        "steward": "Data Engineering",
        "consumers": ["Marketing", "Analytics", "Finance"]
      }
    ],
    "complianceConsiderations": [
      "PII data in customer tables requires encryption",
      "Financial data subject to SOX compliance",
      "GDPR compliance for EU customer data"
    ]
  },
  "recommendations": [
    {
      "priority": "critical",
      "category": "data_quality|performance|architecture|monitoring|governance",
      "recommendation": "Implement automated data quality monitoring for critical pipelines",
      "reasoning": "Prevent data quality issues from propagating downstream",
      "effort": "medium",
      "impact": "high",
      "timeline": "2-4 weeks",
      "stakeholders": ["Data Engineering", "Data Quality Team"]
    }
  ]
}

**DATA PROCESSING ANALYSIS GUIDELINES:**
1. **Focus on data flow patterns** - ETL/ELT pipelines, data transformations, aggregations
2. **Assess data quality impact** - how changes affect data accuracy and completeness
3. **Evaluate performance implications** - query performance, data volume, processing time
4. **Consider business criticality** - revenue impact, regulatory compliance, SLA requirements
5. **Identify data architecture patterns** - medallion, data mesh, lambda architecture
6. **Map data lineage complexity** - upstream/downstream dependencies, transformation logic
7. **Assess scalability concerns** - data volume growth, processing capacity, bottlenecks
8. **Consider data governance** - data ownership, stewardship, compliance requirements

**TECHNOLOGY-SPECIFIC CONSIDERATIONS:**
- **SQL Dependencies**: Table relationships, view dependencies, stored procedure calls
- **Spark Dependencies**: DataFrame transformations, RDD operations, job dependencies
- **Python Dependencies**: Library imports, data pipeline orchestration, ML model dependencies
- **dbt Dependencies**: Model references, source dependencies, macro usage

**BUSINESS CONTEXT INTEGRATION:**
- Use code summaries to understand business logic and transformation purposes
- Map technical dependencies to business processes and stakeholder needs
- Assess business impact of potential failures or changes
- Consider data freshness requirements and SLA implications

**RETURN ONLY VALID JSON:**`;
  }

  private static normalizeDependencyResults(results: any): any {
    // Ensure all required sections exist with defaults
    const normalized = {
      dependencyGraph: {
        nodes: results.dependencyGraph?.nodes || [],
        edges: results.dependencyGraph?.edges || [],
        crossFileConnections: results.dependencyGraph?.crossFileConnections || [],
        criticalPaths: results.dependencyGraph?.criticalPaths || []
      },
      riskAssessment: {
        riskScore: results.riskAssessment?.riskScore || 0,
        criticalDependencies: results.riskAssessment?.criticalDependencies || 0,
        riskFactors: results.riskAssessment?.riskFactors || [],
        vulnerabilities: results.riskAssessment?.vulnerabilities || []
      },
      businessImpactAnalysis: {
        impactAreas: results.businessImpactAnalysis?.impactAreas || [],
        changeImpactRadius: results.businessImpactAnalysis?.changeImpactRadius || {
          coreAssets: [],
          immediateImpact: 0,
          secondaryImpact: 0,
          cascadingEffects: ''
        }
      },
      recommendations: results.recommendations || []
    };

    return normalized;
  }

  // ========================================
  // PHASE 5: COMPREHENSIVE IMPACT ANALYSIS (LLM-ENHANCED)
  // ========================================
  
  /**
   * Phase 5: Comprehensive Impact Analysis
   * - Uses ALL stored data from Phases 1-4
   * - Calls LLM for intelligent impact analysis and strategic recommendations
   * - Provides comprehensive business impact assessment
   * - Generates actionable insights and strategic recommendations
   */
  static async processPhase5Analysis(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!repositoryFullName || !repositoryFullName.includes('/')) {
        return res.status(400).json({ message: 'A valid repositoryFullName is required.' });
      }

      console.log(`📈 PHASE 5: Starting LLM-Enhanced Comprehensive Impact Analysis for ${repositoryFullName}`);

      // ===== STEP 1: GATHER ALL DATA FROM PREVIOUS PHASES =====
      
      // Phase 1: Documentation data
      const { data: codeSummaries, error: summariesError } = await supabaseCodeInsights
        .from('code_summaries')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      // Phase 2: Vector data (for complexity analysis)
      const { data: vectorData, error: vectorError } = await supabaseCodeInsights
        .from('code_vectors')
        .select('file_id, embedding_model, created_at')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      // Phase 3: Lineage data
      const { data: dataAssets, error: assetsError } = await supabaseCodeInsights
        .from('data_assets')
        .select('*')
        .eq('repository_full_name', repositoryFullName);

      const { data: dataLineage, error: lineageError } = await supabaseCodeInsights
        .from('data_lineage')
        .select('*')
        .eq('repository_full_name', repositoryFullName);

      const { data: fileDependencies, error: fileDepsError } = await supabaseCodeInsights
        .from('file_dependencies')
        .select('*')
        .eq('repository_full_name', repositoryFullName);

      // Phase 4: Dependency analysis
      const { data: dependencyAnalysis, error: depAnalysisError } = await supabaseCodeInsights
        .from('repository_dependency_analysis')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .single();

      // Repository files for context
      const { data: repositoryFiles, error: filesError } = await supabaseCodeInsights
        .from('files')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      if (summariesError || vectorError || assetsError || lineageError || fileDepsError || depAnalysisError || filesError) {
        console.error('Error gathering comprehensive data:', { 
          summariesError, vectorError, assetsError, lineageError, fileDepsError, depAnalysisError, filesError 
        });
        throw new Error('Failed to gather comprehensive data for impact analysis');
      }

      console.log(`📊 Comprehensive data gathered:`);
      console.log(`   - Code summaries: ${codeSummaries?.length || 0}`);
      console.log(`   - Vector embeddings: ${vectorData?.length || 0}`);
      console.log(`   - Data assets: ${dataAssets?.length || 0}`);
      console.log(`   - Lineage relationships: ${dataLineage?.length || 0}`);
      console.log(`   - File dependencies: ${fileDependencies?.length || 0}`);
      console.log(`   - Dependency analysis: ${dependencyAnalysis ? 'Available' : 'Missing'}`);
      console.log(`   - Repository files: ${repositoryFiles?.length || 0}`);

      if (!codeSummaries?.length && !dataAssets?.length && !dependencyAnalysis) {
        return res.status(200).json({
          message: 'No data available for comprehensive analysis - Previous phases must be completed first',
          results: {
            overallRiskScore: 0,
            businessImpactScore: 0,
            strategicRecommendations: [],
            executiveSummary: 'No data available for analysis'
          },
          phase: 'analysis',
          status: 'completed'
        });
      }

      // ===== STEP 2: LLM-ENHANCED COMPREHENSIVE IMPACT ANALYSIS =====
      
      const comprehensiveAnalysisResults = await this.performComprehensiveImpactAnalysisWithLLM(
        codeSummaries || [],
        vectorData || [],
        dataAssets || [],
        dataLineage || [],
        fileDependencies || [],
        dependencyAnalysis,
        repositoryFiles || [],
        repositoryFullName
      );

      if (!comprehensiveAnalysisResults) {
        throw new Error('Failed to perform comprehensive impact analysis with LLM');
      }

      // ===== STEP 3: STORE COMPREHENSIVE ANALYSIS RESULTS =====
      
      const impactAnalysisRecord = {
        repository_full_name: repositoryFullName,
        user_id: userId,
        analysis_results: comprehensiveAnalysisResults,
        executive_summary: comprehensiveAnalysisResults.executiveSummary,
        overall_risk_score: comprehensiveAnalysisResults.overallRiskScore,
        business_impact_score: comprehensiveAnalysisResults.businessImpactScore,
        strategic_recommendations: comprehensiveAnalysisResults.strategicRecommendations,
        technical_debt_score: comprehensiveAnalysisResults.technicalDebtAssessment.overallScore,
        change_impact_assessment: comprehensiveAnalysisResults.changeImpactAssessment,
        stakeholder_impact_map: comprehensiveAnalysisResults.stakeholderImpactMap,
        analysis_date: new Date().toISOString(),
        status: 'completed'
      };

      const { error: storeError } = await supabaseCodeInsights
        .from('repository_impact_analysis')
        .upsert([impactAnalysisRecord], {
          onConflict: 'repository_full_name,user_id'
        });

      if (storeError) {
        console.error('Error storing comprehensive impact analysis:', storeError);
        throw new Error(`Failed to store comprehensive impact analysis: ${storeError.message}`);
      }

      console.log(`✅ Successfully completed LLM-enhanced comprehensive impact analysis`);
      console.log(`📊 Overall Risk Score: ${comprehensiveAnalysisResults.overallRiskScore}%`);
      console.log(`🏢 Business Impact Score: ${comprehensiveAnalysisResults.businessImpactScore}%`);
      console.log(`📋 Strategic Recommendations: ${comprehensiveAnalysisResults.strategicRecommendations.length}`);
      console.log(`💡 Technical Debt Score: ${comprehensiveAnalysisResults.technicalDebtAssessment.overallScore}%`);

      return res.status(200).json({
        message: 'Phase 5: LLM-enhanced comprehensive impact analysis completed successfully',
        results: {
          overallRiskScore: comprehensiveAnalysisResults.overallRiskScore,
          businessImpactScore: comprehensiveAnalysisResults.businessImpactScore,
          technicalDebtScore: comprehensiveAnalysisResults.technicalDebtAssessment.overallScore,
          strategicRecommendations: comprehensiveAnalysisResults.strategicRecommendations.length,
          stakeholderImpactAreas: comprehensiveAnalysisResults.stakeholderImpactMap.length,
          changeImpactRadius: comprehensiveAnalysisResults.changeImpactAssessment.impactRadius,
          executiveSummary: comprehensiveAnalysisResults.executiveSummary
        },
        phase: 'analysis',
        status: 'completed'
      });

    } catch (error: any) {
      console.error(`❌ Error in Phase 5 Comprehensive Analysis:`, error);
      return res.status(500).json({ 
        error: 'Phase 5 comprehensive impact analysis failed', 
        details: error.message 
      });
    }
  }

  // ===== LLM-ENHANCED COMPREHENSIVE IMPACT ANALYSIS =====

  private static async performComprehensiveImpactAnalysisWithLLM(
    codeSummaries: any[],
    vectorData: any[],
    dataAssets: any[],
    dataLineage: any[],
    fileDependencies: any[],
    dependencyAnalysis: any,
    repositoryFiles: any[],
    repositoryFullName: string
  ): Promise<any> {
    try {
      // Create comprehensive impact analysis prompt
      const impactAnalysisPrompt = this.createComprehensiveImpactAnalysisPrompt(
        codeSummaries,
        vectorData,
        dataAssets,
        dataLineage,
        fileDependencies,
        dependencyAnalysis,
        repositoryFiles,
        repositoryFullName
      );

      // Call LLM for comprehensive analysis
      const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use powerful model for comprehensive analysis
          messages: [
            {
              role: 'system',
              content: 'You are a senior data architect and business analyst with expertise in comprehensive impact analysis, risk assessment, and strategic technology planning. Provide executive-level insights and actionable strategic recommendations. Return only valid JSON responses.'
            },
            {
              role: 'user',
              content: impactAnalysisPrompt
            }
          ],
          temperature: 0.3, // Balanced temperature for analytical yet creative insights
          max_tokens: 6000 // Increased for comprehensive analysis
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      // Parse JSON response
      let impactResults;
      try {
        impactResults = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM impact analysis response:', content);
        throw new Error('Invalid JSON response from LLM');
      }

      // Validate and normalize structure
      return this.normalizeImpactAnalysisResults(impactResults);

    } catch (error) {
      console.error('Error performing comprehensive impact analysis with LLM:', error);
      return null;
    }
  }

  private static createComprehensiveImpactAnalysisPrompt(
    codeSummaries: any[],
    vectorData: any[],
    dataAssets: any[],
    dataLineage: any[],
    fileDependencies: any[],
    dependencyAnalysis: any,
    repositoryFiles: any[],
    repositoryFullName: string
  ): string {
    // Create comprehensive data context
    const totalFiles = repositoryFiles.length;
    const processedFiles = codeSummaries.length;
    const vectorizedFiles = vectorData.length;
    const dataAssetsCount = dataAssets.length;
    const lineageRelationships = dataLineage.length;
    const crossFileDependencies = fileDependencies.length;

    // Extract key business logic themes
    const businessThemes = codeSummaries
      .map(s => s.summary_json?.business_logic?.main_objectives)
      .filter(Boolean)
      .flat()
      .slice(0, 20);

    // Extract complexity indicators
    const complexityIndicators = codeSummaries
      .map(s => ({
        file: s.file_path,
        complexity: s.summary_json?.complexity || 'Unknown',
        technicalDebt: s.summary_json?.best_practices?.improvements?.length || 0
      }))
      .slice(0, 10);

    return `
You are a senior data architect and business analyst conducting a comprehensive impact analysis for an enterprise data repository.

**REPOSITORY:** ${repositoryFullName}

**COMPREHENSIVE DATA ANALYSIS:**

**REPOSITORY OVERVIEW:**
- Total Files: ${totalFiles}
- Processed Files: ${processedFiles} (${Math.round(processedFiles/totalFiles*100)}% coverage)
- Vectorized Files: ${vectorizedFiles}
- Data Assets Identified: ${dataAssetsCount}
- Lineage Relationships: ${lineageRelationships}
- Cross-File Dependencies: ${crossFileDependencies}

**BUSINESS LOGIC THEMES:**
${JSON.stringify(businessThemes, null, 2)}

**COMPLEXITY INDICATORS:**
${JSON.stringify(complexityIndicators, null, 2)}

**PHASE 1 DATA - CODE SUMMARIES (${codeSummaries.length} files):**
${JSON.stringify(codeSummaries.slice(0, 5), null, 2)} ${codeSummaries.length > 5 ? `... and ${codeSummaries.length - 5} more summaries` : ''}

**PHASE 2 DATA - VECTOR EMBEDDINGS:**
- Files with embeddings: ${vectorData.length}
- Embedding model: ${vectorData[0]?.embedding_model || 'N/A'}
- Vector processing coverage: ${Math.round(vectorData.length/totalFiles*100)}%

**PHASE 3 DATA - DATA LINEAGE:**
**Data Assets (${dataAssets.length}):**
${JSON.stringify(dataAssets.slice(0, 3), null, 2)} ${dataAssets.length > 3 ? `... and ${dataAssets.length - 3} more assets` : ''}

**Lineage Relationships (${dataLineage.length}):**
${JSON.stringify(dataLineage.slice(0, 3), null, 2)} ${dataLineage.length > 3 ? `... and ${dataLineage.length - 3} more relationships` : ''}

**File Dependencies (${fileDependencies.length}):**
${JSON.stringify(fileDependencies.slice(0, 3), null, 2)} ${fileDependencies.length > 3 ? `... and ${fileDependencies.length - 3} more dependencies` : ''}

**PHASE 4 DATA - DEPENDENCY ANALYSIS:**
${dependencyAnalysis ? JSON.stringify(dependencyAnalysis, null, 2) : 'No dependency analysis available'}

**PROVIDE COMPREHENSIVE IMPACT ANALYSIS (valid JSON only):**

{
  "executiveSummary": "2-3 paragraph executive summary highlighting key findings, risks, and strategic implications",
  "overallRiskScore": 85,
  "businessImpactScore": 75,
  "technicalDebtAssessment": {
    "overallScore": 60,
    "criticalIssues": [
      {
        "issue": "High coupling in core data transformation modules",
        "severity": "critical|high|medium|low",
        "affectedFiles": ["file1.sql", "file2.py"],
        "businessImpact": "Risk to daily reporting processes",
        "recommendedAction": "Refactor to reduce coupling"
      }
    ],
    "technicalDebtHotspots": [
      {
        "area": "Data Pipeline X",
        "debtLevel": "high|medium|low",
        "effort": "high|medium|low",
        "businessValue": "high|medium|low",
        "priority": "immediate|short-term|long-term"
      }
    ]
  },
  "changeImpactAssessment": {
    "impactRadius": 8,
    "criticalPathAnalysis": [
      {
        "path": "source → transformation → target",
        "businessProcess": "Monthly financial reporting",
        "riskLevel": "critical|high|medium|low",
        "stakeholders": ["Finance", "Executive"],
        "changeComplexity": "high|medium|low"
      }
    ],
    "cascadingEffects": [
      {
        "trigger": "Change in core table schema",
        "immediateImpact": "3 downstream tables affected",
        "secondaryImpact": "5 reports need updates",
        "businessImpact": "Potential reporting delays",
        "mitigationStrategy": "Implement versioning"
      }
    ]
  },
  "stakeholderImpactMap": [
    {
      "stakeholder": "Finance Team",
      "impactLevel": "critical|high|medium|low",
      "affectedProcesses": ["Monthly reporting", "Budget analysis"],
      "dependentAssets": ["revenue_table", "cost_analysis"],
      "riskExposure": "High - Core business processes depend on these assets",
      "recommendedActions": ["Implement data quality monitoring", "Create backup processes"]
    }
  ],
  "strategicRecommendations": [
    {
      "category": "Architecture|Data Quality|Risk Management|Process Improvement",
      "priority": "immediate|short-term|long-term",
      "recommendation": "Implement data lineage monitoring system",
      "businessJustification": "Reduce risk of data pipeline failures",
      "effort": "high|medium|low",
      "expectedROI": "high|medium|low",
      "timeframe": "3-6 months",
      "successMetrics": ["Reduced incident response time", "Improved data quality"]
    }
  ],
  "riskMitigationPlan": [
    {
      "risk": "Single point of failure in data pipeline",
      "likelihood": "high|medium|low",
      "impact": "critical|high|medium|low",
      "currentMitigation": "None",
      "recommendedMitigation": "Implement redundant processing paths",
      "timeline": "Immediate",
      "owner": "Data Engineering Team"
    }
  ],
  "performanceOptimizationOpportunities": [
    {
      "area": "Query optimization in reporting layer",
      "currentPerformance": "Slow queries affecting user experience",
      "optimizationPotential": "50% performance improvement",
      "effort": "medium",
      "businessValue": "Improved user satisfaction"
    }
  ],
  "dataGovernanceRecommendations": [
    {
      "area": "Data Classification",
      "currentState": "Unclassified data assets",
      "recommendedState": "Implement data classification framework",
      "businessBenefit": "Improved compliance and security",
      "implementation": "6-month initiative"
    }
  ]
}

**ANALYSIS GUIDELINES:**
1. **Executive Perspective** - Focus on business impact and strategic implications
2. **Risk-Based Analysis** - Identify and quantify business risks
3. **Stakeholder Impact** - Map technical changes to business stakeholder impact
4. **Strategic Recommendations** - Provide actionable, prioritized recommendations
5. **ROI Consideration** - Balance effort vs. business value
6. **Comprehensive Assessment** - Use ALL available data phases for insights
7. **Business Context** - Connect technical findings to business outcomes
8. **Future-Proofing** - Consider scalability and maintainability

**FOCUS AREAS:**
- Overall business risk assessment
- Technical debt impact on business operations
- Change impact radius and stakeholder effects
- Strategic recommendations with business justification
- Risk mitigation strategies
- Performance optimization opportunities
- Data governance and compliance considerations

**RETURN ONLY VALID JSON:**`;
  }

  private static normalizeImpactAnalysisResults(results: any): any {
    // Ensure all required sections exist with defaults
    const normalized = {
      executiveSummary: results.executiveSummary || 'No executive summary available',
      overallRiskScore: results.overallRiskScore || 0,
      businessImpactScore: results.businessImpactScore || 0,
      technicalDebtAssessment: {
        overallScore: results.technicalDebtAssessment?.overallScore || 0,
        criticalIssues: results.technicalDebtAssessment?.criticalIssues || [],
        technicalDebtHotspots: results.technicalDebtAssessment?.technicalDebtHotspots || []
      },
      changeImpactAssessment: {
        impactRadius: results.changeImpactAssessment?.impactRadius || 0,
        criticalPathAnalysis: results.changeImpactAssessment?.criticalPathAnalysis || [],
        cascadingEffects: results.changeImpactAssessment?.cascadingEffects || []
      },
      stakeholderImpactMap: results.stakeholderImpactMap || [],
      strategicRecommendations: results.strategicRecommendations || [],
      riskMitigationPlan: results.riskMitigationPlan || [],
      performanceOptimizationOpportunities: results.performanceOptimizationOpportunities || [],
      dataGovernanceRecommendations: results.dataGovernanceRecommendations || []
    };

    return normalized;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================
  
  /**
   * Get processing status for a specific phase
   */
  static async getPhaseStatus(req: Request, res: Response) {
    try {
      const { repositoryFullName, phase } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get status from database based on phase
      const { data: statusData, error } = await supabaseCodeInsights
        .rpc('get_repository_processing_status', {
          repo_full_name: repositoryFullName,
          user_id_param: userId
        });

      if (error) {
        throw new Error(`Failed to get status: ${error.message}`);
      }

      const status = statusData?.[0];
      if (!status) {
        return res.status(404).json({ message: 'No processing data found for this repository' });
      }

      // Return phase-specific status
      const phaseStatus = {
        phase,
        repositoryFullName,
        totalFiles: status.total_files,
        status: 'unknown'
      };

      switch (phase) {
        case 'documentation':
          phaseStatus.status = status.documentation_completed >= status.total_files ? 'completed' : 'processing';
          break;
        case 'vectors':
          phaseStatus.status = status.vector_completed >= status.total_files ? 'completed' : 'processing';
          break;
        case 'lineage':
          // Check lineage completion from lineage tables
          phaseStatus.status = 'completed'; // Simplified for now
          break;
        case 'dependencies':
          // Check dependency analysis table
          const { data: depAnalysis } = await supabaseCodeInsights
            .from('repository_dependency_analysis')
            .select('status')
            .eq('repository_full_name', repositoryFullName)
            .eq('user_id', userId)
            .single();
          phaseStatus.status = depAnalysis?.status || 'pending';
          break;
        case 'analysis':
          // Check impact analysis table
          const { data: impactAnalysis } = await supabaseCodeInsights
            .from('repository_impact_analysis')
            .select('status')
            .eq('repository_full_name', repositoryFullName)
            .eq('user_id', userId)
            .single();
          phaseStatus.status = impactAnalysis?.status || 'pending';
          break;
      }

      return res.status(200).json(phaseStatus);

    } catch (error: any) {
      console.error(`Error getting phase status:`, error);
      return res.status(500).json({ 
        error: 'Failed to get phase status', 
        details: error.message 
      });
    }
  }

  // ===== HELPER METHODS FOR LINEAGE PROCESSING =====

  private static async resolveAssetIds(relationships: any[], repositoryFullName: string): Promise<any[]> {
    const resolvedRelationships: any[] = [];
    
    for (const rel of relationships) {
      try {
        // Find source asset
        const { data: sourceAsset } = await supabaseCodeInsights
          .from('data_assets')
          .select('id')
          .eq('repository_full_name', repositoryFullName)
          .eq('name', rel.source_asset_name)
          .single();

        // Find target asset
        const { data: targetAsset } = await supabaseCodeInsights
          .from('data_assets')
          .select('id')
          .eq('repository_full_name', repositoryFullName)
          .eq('name', rel.target_asset_name)
          .single();

        if (sourceAsset && targetAsset) {
          resolvedRelationships.push({
            ...rel,
            source_asset_id: sourceAsset.id,
            target_asset_id: targetAsset.id
          });
        }
      } catch (error) {
        console.log(`Could not resolve asset IDs for ${rel.source_asset_name} -> ${rel.target_asset_name}`);
      }
    }

    return resolvedRelationships;
  }

  private static async resolveFileDependencyIds(fileDeps: any[], repositoryFullName: string, userId: string): Promise<any[]> {
    const resolvedDeps: any[] = [];
    
    for (const dep of fileDeps) {
      try {
        // Find target file
        const { data: targetFile } = await supabaseCodeInsights
          .from('files')
          .select('id')
          .eq('repository_full_name', repositoryFullName)
          .eq('user_id', userId)
          .ilike('file_path', `%${dep.target_file_path}%`)
          .single();

        if (targetFile) {
          resolvedDeps.push({
            ...dep,
            target_file_id: targetFile.id
          });
        }
      } catch (error) {
        console.log(`Could not resolve file ID for ${dep.target_file_path}`);
      }
    }

    return resolvedDeps;
  }
} 