import { supabase } from '../../config/supabase';
import { EnhancedSQLParser } from './parsers/EnhancedSQLParser';
import { PythonParserService } from './parsers/PythonParserService';
import { DBTParserService } from './parsers/DBTParserService';
import { EnhancedDependencyAnalyzer } from './analyzers/EnhancedDependencyAnalyzer';
import { LineageCalculator } from './analyzers/LineageCalculator';
import { MetadataStorageService } from './storage/MetadataStorageService';
import { TantivySearchService } from '../TantivySearchService';
import { FileIndexingService } from '../FileIndexingService';
import { decryptGitHubToken } from '../encryptionService';
import axios from 'axios';

interface ParsedObject {
  name: string;
  schema_name?: string;
  database_name?: string;
  object_type: string;
  definition: string;
  line_start?: number;
  line_end?: number;
  columns?: ParsedColumn[];
  dependencies?: string[];
  confidence: number;
}

interface ParsedColumn {
  name: string;
  data_type?: string;
  is_nullable?: boolean;
  position?: number;
}

/**
 * Enterprise Metadata Extraction Orchestrator
 * 
 * Pipeline:
 * 1. File Discovery (GitHub API)
 * 2. Parallel Parsing (SQLglot for SQL, AST for Python, DBT manifest)
 * 3. Storage (Supabase metadata schema)
 * 4. Dependency Analysis
 * 5. Column Lineage Calculation
 * 6. Quality Scoring
 */
export class MetadataExtractionOrchestrator {
  private static instance: MetadataExtractionOrchestrator;
  
  private sqlParser: EnhancedSQLParser;
  private pythonParser: PythonParserService;
  private dbtParser: DBTParserService;
  private dependencyAnalyzer: EnhancedDependencyAnalyzer;
  private lineageCalculator: LineageCalculator;
  private storage: MetadataStorageService;

  private constructor() {
    this.sqlParser = new EnhancedSQLParser();
    this.pythonParser = new PythonParserService();
    this.dbtParser = new DBTParserService();
    this.dependencyAnalyzer = new EnhancedDependencyAnalyzer();
    this.lineageCalculator = new LineageCalculator();
    this.storage = new MetadataStorageService();
  }

  static getInstance(): MetadataExtractionOrchestrator {
    if (!MetadataExtractionOrchestrator.instance) {
      MetadataExtractionOrchestrator.instance = new MetadataExtractionOrchestrator();
    }
    return MetadataExtractionOrchestrator.instance;
  }

  /**
   * Main extraction pipeline
   */
  async startExtraction(jobId: string): Promise<void> {
    console.log(`🚀 Starting metadata extraction job: ${jobId}`);
    
    let jobData: any = null;
    
    try {
      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('metadata_extraction_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error(`Job ${jobId} not found`);
      }

      jobData = job;

      // Get connection details separately
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('id', job.connection_id)
        .single();

      if (connError || !connection) {
        throw new Error(`Connection ${job.connection_id} not found`);
      }

      // Combine job and connection data
      const fullJob = {
        ...job,
        connection: connection
      };

      await this.updateJobStatus(jobId, 'processing', 'Cleaning old data...');

      // Phase 0: Clean old data to avoid duplicates
      await this.cleanOldData(job.connection_id, job.organization_id);
      console.log(`🧹 Cleaned old metadata for connection ${job.connection_id}`);

      await this.updateJobStatus(jobId, 'processing', 'Discovering files...');

      // Phase 1: File Discovery
      const files = await this.discoverFiles(fullJob);
      console.log(`📁 Discovered ${files.length} files`);

      await this.updateJobProgress(jobId, {
        phase: 'File Discovery',
        files_total: files.length,
        files_processed: 0,
        progress: 5
      });

      // Update connection with file count
      await supabase
        .schema('enterprise')
        .from('github_connections')
        .update({ total_files: files.length })
        .eq('id', job.connection_id);

      // Phase 2: Parse Files
      const parseResults = await this.parseAllFiles(jobId, fullJob, files);
      console.log(`📊 Parsed ${parseResults.length} files`);

      // Phase 3: Dependency Analysis
      await this.updateJobProgress(jobId, {
        phase: 'Analyzing Dependencies',
        progress: 70
      });
      await this.dependencyAnalyzer.analyzeDependencies(job.organization_id, job.connection_id);

      // Phase 4: Column Lineage
      await this.updateJobProgress(jobId, {
        phase: 'Calculating Lineage',
        progress: 85
      });
      await this.lineageCalculator.calculateLineage(job.organization_id, job.connection_id);

      // Phase 5: Quality Scoring
      const qualityScore = await this.calculateQualityScore(job.organization_id, job.connection_id);

      // Complete job
      await this.completeJob(jobId, job.connection_id, qualityScore);
      
      console.log(`✅ Extraction job ${jobId} completed with quality score: ${qualityScore}%`);

    } catch (error) {
      console.error(`❌ Extraction job ${jobId} failed:`, error);
      if (jobData) {
        await this.failJob(jobId, jobData.connection_id, error);
      }
      throw error;
    }
  }

  /**
   * Phase 0: Clean old metadata to prevent duplicates
   */
  private async cleanOldData(connectionId: string, organizationId: string): Promise<void> {
    console.log(`🧹 Cleaning old metadata for connection ${connectionId}...`);
    
    // Delete in correct order due to foreign key constraints
    // 1. Column lineage (references columns)
    await supabase
      .schema('metadata')
      .from('columns_lineage')
      .delete()
      .eq('organization_id', organizationId);

    // 2. Dependencies (references objects)
    await supabase
      .schema('metadata')
      .from('dependencies')
      .delete()
      .eq('organization_id', organizationId);

    // 3. Columns (references objects)
    await supabase
      .schema('metadata')
      .from('columns')
      .delete()
      .eq('organization_id', organizationId);

    // 4. Objects (references files)
    await supabase
      .schema('metadata')
      .from('objects')
      .delete()
      .eq('connection_id', connectionId);

    // 5. Files
    await supabase
      .schema('metadata')
      .from('files')
      .delete()
      .eq('connection_id', connectionId);

    console.log(`✅ Old metadata cleaned for connection ${connectionId}`);
  }

  /**
   * Phase 1: Discover files from GitHub
   */
  private async discoverFiles(job: any): Promise<any[]> {
    const { repository_owner, repository_name, branch, access_token_encrypted } = job.connection;
    
    try {
      // Decrypt the GitHub access token
      const decryptedToken = decryptGitHubToken(access_token_encrypted);
      
      // Get repository tree
      const response = await axios.get(
        `https://api.github.com/repos/${repository_owner}/${repository_name}/git/trees/${branch}?recursive=1`,
        {
          headers: {
            'Authorization': `token ${decryptedToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      const allFiles = response.data.tree;
      
      // Filter relevant files
      const patterns = job.config?.filePatterns || [
        '**/*.sql',
        '**/*.py',
        '**/dbt_project.yml',
        '**/models/**/*.sql'
      ];

      const relevantFiles = allFiles.filter((file: any) => {
        if (file.type !== 'blob') return false;
        return this.matchesPattern(file.path, patterns);
      });

      // Store file records
      const { data: repo } = await supabase
        .schema('metadata')
        .from('repositories')
        .select('id')
        .eq('connection_id', job.connection_id)
        .single();

      if (repo) {
        for (const file of relevantFiles) {
          await this.storage.storeFile({
            repository_id: repo.id,
            organization_id: job.organization_id,
            connection_id: job.connection_id,
            relative_path: file.path,
            absolute_path: file.path,
            file_type: this.detectFileType(file.path),
            file_hash: file.sha,
            size_bytes: file.size || 0
          });
        }
      }

      return relevantFiles;
    } catch (error) {
      console.error('Error discovering files:', error);
      throw new Error(`Failed to discover files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Phase 2: Parse all files
   */
  private async parseAllFiles(jobId: string, job: any, files: any[]): Promise<any[]> {
    const results: any[] = [];
    const batchSize = 5; // Process in small batches

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Parallel processing within batch
      const batchResults = await Promise.allSettled(
        batch.map(file => this.parseFile(job, file))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }

      // Update progress
      const progress = 5 + Math.round((i + batchSize) / files.length * 60);
      await this.updateJobProgress(jobId, {
        files_processed: Math.min(i + batchSize, files.length),
        files_total: files.length,
        phase: 'Parsing Files',
        progress
      });
    }

    // Update totals
    const totalObjects = results.reduce((sum, r) => sum + (r.objectCount || 0), 0);
    const totalColumns = results.reduce((sum, r) => sum + (r.columnCount || 0), 0);
    
    await supabase
      .from('metadata_extraction_jobs')
      .update({
        objects_extracted: totalObjects,
        columns_extracted: totalColumns
      })
      .eq('id', jobId);

    return results;
  }

  /**
   * Parse a single file
   */
  private async parseFile(job: any, file: any): Promise<any> {
    try {
      const fileType = this.detectFileType(file.path);
      
      // Get file content from GitHub
      const content = await this.fetchFileContent(job.connection, file.path);
      
      let parseResult: any;

      // Route to appropriate parser
      if (fileType === 'sql') {
        parseResult = await this.sqlParser.parseSQL(content, {
          dialect: this.detectSQLDialect(content, file.path),
          filePath: file.path
        });
      } else if (fileType === 'python' || fileType === 'pyspark') {
        parseResult = await this.pythonParser.parsePython(content, {
          filePath: file.path
        });
      } else if (fileType === 'dbt') {
        parseResult = await this.dbtParser.parseDBTProject(file.path, content);
      } else {
        return null;
      }

      if (!parseResult || !parseResult.objects || parseResult.objects.length === 0) {
        return { filePath: file.path, objectCount: 0, columnCount: 0 };
      }

      // Get file record
      const { data: fileRecord } = await supabase
        .schema('metadata')
        .from('files')
        .select('id, repository_id')
        .eq('connection_id', job.connection_id)
        .eq('relative_path', file.path)
        .single();

      if (!fileRecord) {
        throw new Error(`File record not found for ${file.path}`);
      }

      // Store parsed objects and track their IDs for dependency resolution
      const objectNameToId = new Map<string, string>();
      
      console.log(`🔍 [ORCHESTRATOR] Processing ${parseResult.objects.length} objects from ${file.path}`);
      
      for (const obj of parseResult.objects) {
        console.log(`[ORCH-LOOP] Processing object: ${obj.name}, has columns: ${obj.columns?.length || 0}`);
        
        const storedObject = await this.storage.storeObject({
          file_id: fileRecord.id,
          repository_id: fileRecord.repository_id,
          organization_id: job.organization_id,
          connection_id: job.connection_id,
          name: obj.name,
          schema_name: obj.schema_name,
          database_name: obj.database_name,
          object_type: obj.object_type,
          definition: obj.definition,
          line_start: obj.line_start,
          line_end: obj.line_end,
          confidence: obj.confidence || 0.9
        });

        console.log(`[ORCH-LOOP] storedObject for ${obj.name}:`, storedObject ? 'EXISTS' : 'NULL');

        if (storedObject) {
          // Track object name -> ID mapping for dependency resolution
          objectNameToId.set(obj.name, storedObject.id);
          
          // Debug logging
          console.log(`[DEBUG] Object ${obj.name}: columns=`, obj.columns);
          
          if (obj.columns && obj.columns.length > 0) {
            console.log(`📊 Storing ${obj.columns.length} columns for ${obj.name}`);
            try {
              await this.storage.storeColumns(storedObject.id, obj.columns, job.organization_id);
              console.log(`✅ Successfully stored columns for ${obj.name}`);
            } catch (error) {
              console.error(`❌ Failed to store columns for ${obj.name}:`, error);
              throw error;
            }
          } else {
            console.log(`⚠️  No columns found for ${obj.name}`);
          }
        }
      }
      
      // Store dependencies if parser extracted them
      if (parseResult.dependencies && parseResult.dependencies.length > 0) {
        console.log(`🔗 Storing ${parseResult.dependencies.length} dependencies for ${file.path}`);
        await this.storeParsedDependencies(
          parseResult.dependencies,
          objectNameToId,
          job.organization_id,
          fileRecord.repository_id
        );
      }

      // Update file as parsed
      await supabase
        .schema('metadata')
        .from('files')
        .update({
          parsed_at: new Date().toISOString(),
          parser_used: parseResult.parserUsed || 'sqlglot',
          parse_confidence: parseResult.confidence || 0.9
        })
        .eq('id', fileRecord.id);

      return {
        filePath: file.path,
        fileType,
        objectCount: parseResult.objects.length,
        columnCount: parseResult.objects.reduce((sum: number, o: any) => 
          sum + (o.columns?.length || 0), 0
        )
      };

    } catch (error) {
      console.error(`Error parsing file ${file.path}:`, error);
      return {
        filePath: file.path,
        error: error instanceof Error ? error.message : 'Unknown error',
        objectCount: 0
      };
    }
  }

  /**
   * Fetch file content from GitHub
   */
  private async fetchFileContent(connection: any, filePath: string): Promise<string> {
    try {
      // Decrypt the GitHub access token
      const decryptedToken = decryptGitHubToken(connection.access_token_encrypted);
      
      const response = await axios.get(
        `https://api.github.com/repos/${connection.repository_owner}/${connection.repository_name}/contents/${filePath}?ref=${connection.branch}`,
        {
          headers: {
            'Authorization': `token ${decryptedToken}`,
            'Accept': 'application/vnd.github.v3.raw'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch ${filePath}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Calculate metadata quality score
   */
  private async calculateQualityScore(orgId: string, connId: string): Promise<number> {
    try {
      const { data: report } = await supabase
        .rpc('metadata.get_quality_report', {
          p_organization_id: orgId,
          p_connection_id: connId
        });

      return report?.quality_score || 0;
    } catch (error) {
      console.error('Error calculating quality score:', error);
      return 0;
    }
  }

  /**
   * Helper methods
   */
  private matchesPattern(path: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(path);
    });
  }

  private detectFileType(path: string): string {
    if (path.endsWith('.sql')) return 'sql';
    if (path.endsWith('.py')) return 'python';
    if (path.includes('dbt_project.yml')) return 'dbt';
    if (path.endsWith('.ipynb')) return 'jupyter';
    return 'unknown';
  }

  private detectSQLDialect(content: string, path: string): string {
    // Simple dialect detection
    if (content.includes('SNOWFLAKE') || path.includes('snowflake')) return 'snowflake';
    if (content.includes('BIGQUERY') || path.includes('bigquery')) return 'bigquery';
    if (content.includes('CREATE OR REPLACE')) return 'postgres';
    if (content.includes('SPARK')) return 'spark';
    return 'ansi';
  }

  private async updateJobStatus(jobId: string, status: string, phase?: string) {
    await supabase
      .from('metadata_extraction_jobs')
      .update({ 
        status,
        phase,
        ...(status === 'processing' && { started_at: new Date().toISOString() })
      })
      .eq('id', jobId);
  }

  private async updateJobProgress(jobId: string, updates: any) {
    await supabase
      .from('metadata_extraction_jobs')
      .update(updates)
      .eq('id', jobId);
  }

  private async completeJob(jobId: string, connectionId: string, qualityScore: number) {
    // Update job
    await supabase
      .from('metadata_extraction_jobs')
      .update({
        status: 'completed',
        phase: 'Completed',
        progress: 100,
        quality_score: qualityScore,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Update connection with stats
    // Count objects
    const { count: objectCount } = await supabase
      .schema('metadata')
      .from('objects')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId);

    // Count columns (via RPC or count)
    const { data: objects } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id')
      .eq('connection_id', connectionId);

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

    await supabase
      .schema('enterprise')
      .from('github_connections')
      .update({
        status: 'completed',
        last_extraction_at: new Date().toISOString(),
        extraction_quality_score: qualityScore,
        total_objects: objectCount || 0,
        total_columns: columnCount
      })
      .eq('id', connectionId);

    // Trigger search index creation (async, non-blocking)
    // This happens automatically - users don't need to know about it
    console.log(`📊 Fetching organization_id for connection: ${connectionId}`);
    const { data: connection } = await supabase
      .schema('enterprise')
      .from('github_connections')
      .select('organization_id')
      .eq('id', connectionId)
      .single();

    if (connection?.organization_id) {
      console.log(`🚀 Starting Tantivy indexing for org: ${connection.organization_id}`);
      // Fire and forget - don't block on search indexing
      TantivySearchService.getInstance()
        .triggerIndexing(connection.organization_id)
        .catch(err => {
          console.error('❌ Search indexing error:', err);
          console.error('   Error details:', err instanceof Error ? err.stack : err);
        });
      
      // Also index files for code search (async, non-blocking)
      console.log(`📄 Starting file indexing for connection: ${connectionId}`);
      this.indexFilesAsync(connectionId, connection.organization_id)
        .catch(err => {
          console.error('❌ File indexing error:', err);
          console.error('   Error details:', err instanceof Error ? err.stack : err);
        });
    } else {
      console.warn(`⚠️  No organization_id found for connection: ${connectionId}`);
    }
  }

  /**
   * Store dependencies extracted from parser
   * Resolves object names to IDs and handles dbt ref() patterns
   */
  private async storeParsedDependencies(
    dependencies: string[],
    objectNameToId: Map<string, string>,
    organizationId: string,
    repositoryId: string
  ): Promise<void> {
    // Query all objects in this organization to resolve dependency names
    const { data: allObjects } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, full_name, schema_name')
      .eq('organization_id', organizationId);

    if (!allObjects) return;

    // Create name lookup map
    const nameToObjectId = new Map<string, string>();
    for (const obj of allObjects) {
      nameToObjectId.set(obj.name, obj.id);
      if (obj.full_name) nameToObjectId.set(obj.full_name, obj.id);
      if (obj.schema_name) {
        nameToObjectId.set(`${obj.schema_name}.${obj.name}`, obj.id);
      }
    }

    // Store each dependency
    for (const depName of dependencies) {
      // Try to resolve target object
      const targetObjectId = nameToObjectId.get(depName);
      
      if (!targetObjectId) {
        console.log(`⚠️  Dependency target not found: ${depName} (will be resolved in dependency analysis phase)`);
        continue;
      }

      // Store all source objects that reference this target
      for (const [sourceName, sourceId] of objectNameToId) {
        try {
          await this.storage.storeDependency({
            organization_id: organizationId,
            repository_id: repositoryId,
            source_object_id: sourceId,
            target_object_id: targetObjectId,
            dependency_type: 'reference',
            confidence: 0.85
          });
        } catch (error) {
          // Ignore duplicate key errors
          if (error instanceof Error && !error.message.includes('duplicate')) {
            console.error(`Error storing dependency ${sourceName} -> ${depName}:`, error);
          }
        }
      }
    }
  }

  /**
   * Index files for Tantivy code search (async)
   */
  private async indexFilesAsync(connectionId: string, organizationId: string): Promise<void> {
    console.log(`📄 Starting file indexing for connection: ${connectionId}`);
    
    try {
      // Get connection details
      const { data: conn } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('repository_owner, repository_name, branch, access_token_encrypted')
        .eq('id', connectionId)
        .single();
      
      if (!conn) return;
      
      // Get repository ID
      const { data: repo } = await supabase
        .schema('metadata')
        .from('repositories')
        .select('id, name')
        .eq('connection_id', connectionId)
        .single();
      
      if (!repo) return;
      
      // Decrypt the GitHub access token
      const decryptedToken = decryptGitHubToken(conn.access_token_encrypted);
      
      // Get repository tree
      const response = await axios.get(
        `https://api.github.com/repos/${conn.repository_owner}/${conn.repository_name}/git/trees/${conn.branch}?recursive=1`,
        {
          headers: {
            'Authorization': `token ${decryptedToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      // Filter code files (SQL, Python, JS/TS)
      const codeFiles = response.data.tree.filter((file: any) => {
        if (file.type !== 'blob') return false;
        const ext = file.path.split('.').pop()?.toLowerCase();
        return ['sql', 'py', 'js', 'ts', 'jsx', 'tsx'].includes(ext || '');
      });
      
      console.log(`   Found ${codeFiles.length} code files to index`);
      
      // Limit to reasonable number for performance
      const filesToIndex = codeFiles.slice(0, 100);
      
      // Fetch file contents
      const filesWithContent = [];
      for (const file of filesToIndex) {
        try {
          const contentResponse = await axios.get(
            `https://api.github.com/repos/${conn.repository_owner}/${conn.repository_name}/contents/${file.path}?ref=${conn.branch}`,
            {
              headers: {
                'Authorization': `token ${decryptedToken}`,
                'Accept': 'application/vnd.github.v3.raw'
              }
            }
          );
          
          filesWithContent.push({
            content: contentResponse.data,
            filePath: file.path
          });
        } catch (err) {
          console.warn(`   Skipping file ${file.path}:`, err instanceof Error ? err.message : 'error');
        }
      }
      
      console.log(`   Fetched ${filesWithContent.length} file contents`);
      
      // Index files via FileIndexingService
      if (filesWithContent.length > 0) {
        const result = await FileIndexingService.getInstance().indexFiles(
          filesWithContent,
          {
            organizationId,
            repositoryId: repo.id,
            repositoryName: repo.name
          }
        );
        
        console.log(`   ✅ File indexing complete: ${result.filesIndexed} files indexed`);
      }
    } catch (error) {
      console.error('File indexing error:', error instanceof Error ? error.message : error);
    }
  }

  private async failJob(jobId: string, connectionId: string, error: any) {
    await supabase
      .from('metadata_extraction_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    await supabase
      .from('enterprise.github_connections')
      .update({ status: 'error' })
      .eq('id', connectionId);
  }
}
