import { DbtRunner } from './DbtRunner';
import { ManifestParser } from '../parsers/ManifestParser';
import { supabase } from '../../../config/supabase';
import EventEmitter from 'events';

export enum ExtractionPhase {
  QUEUED = 'queued',
  CLONING = 'cloning',
  INSTALLING_DEPS = 'installing_deps',
  PARSING = 'parsing',
  STORING = 'storing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ExtractionProgress {
  connectionId: string;
  phase: ExtractionPhase;
  progress: number; // 0-100
  message: string;
  startTime: Date;
  currentStepStartTime: Date;
  errors: string[];
}

export interface ExtractionResult {
  success: boolean;
  connectionId: string;
  models: number;
  sources: number;
  dependencies: number;
  columnLineage: number;
  duration: number;
  errors: string[];
}

export class ExtractionOrchestrator extends EventEmitter {
  private dbtRunner: DbtRunner;
  private manifestParser: ManifestParser;
  private activeExtractions: Map<string, ExtractionProgress>;

  constructor() {
    super();
    this.dbtRunner = new DbtRunner();
    this.manifestParser = new ManifestParser();
    this.activeExtractions = new Map();
  }

  /**
   * Start metadata extraction for a connection
   */
  async startExtraction(connectionId: string): Promise<ExtractionResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Starting extraction for connection: ${connectionId}`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = new Date();

    // Initialize progress tracking
    const progress: ExtractionProgress = {
      connectionId,
      phase: ExtractionPhase.QUEUED,
      progress: 0,
      message: 'Extraction queued',
      startTime,
      currentStepStartTime: startTime,
      errors: []
    };

    this.activeExtractions.set(connectionId, progress);
    this.emitProgress(progress);

    try {
      // Update connection status
      await this.updateConnectionStatus(connectionId, 'extracting');

      // Get connection details
      const connection = await this.getConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Phase 1: Clone repository
      await this.updatePhase(connectionId, ExtractionPhase.CLONING, 10, 'Cloning repository...');
      
      const dbtResult = await this.dbtRunner.extractMetadata(
        connection.repository_url,
        connection.branch,
        connection.access_token_encrypted // TODO: Decrypt
      );

      if (!dbtResult.success) {
        throw new Error(`dbt parse failed: ${dbtResult.errors.join(', ')}`);
      }

      // Phase 2: Parse manifest
      await this.updatePhase(connectionId, ExtractionPhase.PARSING, 60, 'Parsing manifest...');
      
      const parsed = await this.manifestParser.parseManifest(
        JSON.stringify(dbtResult.manifest)
      );

      console.log(`📊 Parsed manifest:`);
      console.log(`   Models: ${parsed.models.length}`);
      console.log(`   Sources: ${parsed.sources.length}`);
      console.log(`   Dependencies: ${parsed.dependencies.length}`);
      console.log(`   Column Lineage: ${parsed.columnLineage.length}`);

      // Phase 3: Store in database
      await this.updatePhase(connectionId, ExtractionPhase.STORING, 80, 'Storing in database...');
      
      await this.storeManifestData(connectionId, connection.organization_id, parsed);

      // Mark as complete
      await this.updatePhase(connectionId, ExtractionPhase.COMPLETED, 100, 'Extraction completed');
      
      await this.updateConnectionStatus(connectionId, 'completed');
      await this.markManifestUploaded(
        connectionId,
        dbtResult.manifest.metadata?.dbt_schema_version || 'unknown',
        dbtResult.manifest.metadata?.dbt_version || 'unknown'
      );

      const duration = Date.now() - startTime.getTime();

      const result: ExtractionResult = {
        success: true,
        connectionId,
        models: parsed.models.length,
        sources: parsed.sources.length,
        dependencies: parsed.dependencies.length,
        columnLineage: parsed.columnLineage.length,
        duration,
        errors: []
      };

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Extraction completed successfully`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`${'='.repeat(60)}\n`);

      this.activeExtractions.delete(connectionId);
      this.emit('extraction-complete', result);

      return result;

    } catch (error: any) {
      console.error(`\n❌ Extraction failed:`, error.message);

      await this.updatePhase(
        connectionId,
        ExtractionPhase.FAILED,
        0,
        `Extraction failed: ${error.message}`
      );

      await this.updateConnectionStatus(connectionId, 'failed', error.message);

      const result: ExtractionResult = {
        success: false,
        connectionId,
        models: 0,
        sources: 0,
        dependencies: 0,
        columnLineage: 0,
        duration: Date.now() - startTime.getTime(),
        errors: [error.message]
      };

      this.activeExtractions.delete(connectionId);
      this.emit('extraction-failed', result);

      throw error;
    }
  }

  /**
   * Get extraction progress for a connection
   */
  getProgress(connectionId: string): ExtractionProgress | null {
    return this.activeExtractions.get(connectionId) || null;
  }

  /**
   * Get all active extractions
   */
  getActiveExtractions(): string[] {
    return Array.from(this.activeExtractions.keys());
  }

  /**
   * Cancel an active extraction (or reset failed/error status)
   */
  async cancelExtraction(connectionId: string): Promise<boolean> {
    // Check if extraction is in memory (actively running)
    const progress = this.activeExtractions.get(connectionId);
    
    // Also check database status
    const connection = await this.getConnection(connectionId);
    
    // Allow canceling if:
    // 1. Actively running (in memory)
    // 2. Database shows extracting/failed/error (allows reset)
    const cancelableStatuses = ['extracting', 'failed', 'error'];
    const canCancel = progress || cancelableStatuses.includes(connection.status);
    
    if (!canCancel) {
      console.log(`⚠️  Cannot cancel extraction for: ${connectionId}`);
      console.log(`   Connection status: ${connection.status}`);
      console.log(`   Tip: Status must be 'extracting', 'failed', or 'error' to cancel`);
      return false;
    }

    console.log(`🛑 Cancelling/resetting extraction for connection: ${connectionId}`);
    console.log(`   Current status: ${connection.status}`);

    // Clean up in-memory tracking if it exists
    if (progress) {
      await this.updatePhase(
        connectionId,
        ExtractionPhase.FAILED,
        0,
        'Extraction cancelled by user'
      );
    }

    // Always reset connection status to clean state
    await this.updateConnectionStatus(connectionId, 'connected', undefined);

    // Clean up in-memory state
    this.activeExtractions.delete(connectionId);

    this.emit('extraction-cancelled', { connectionId });

    console.log(`✅ Extraction cancelled/reset to 'connected' status`);

    return true;
  }

  // Private helper methods

  private async updatePhase(
    connectionId: string,
    phase: ExtractionPhase,
    progress: number,
    message: string
  ): Promise<void> {
    const extraction = this.activeExtractions.get(connectionId);
    if (extraction) {
      extraction.phase = phase;
      extraction.progress = progress;
      extraction.message = message;
      extraction.currentStepStartTime = new Date();
      
      this.emitProgress(extraction);
    }

    console.log(`📍 [${progress}%] ${message}`);
  }

  private emitProgress(progress: ExtractionProgress): void {
    this.emit('progress', progress);
  }

  private async getConnection(connectionId: string): Promise<any> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('github_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error) throw error;
    return data;
  }

  private async updateConnectionStatus(
    connectionId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    await supabase
      .schema('enterprise')
      .from('github_connections')
      .update(updates)
      .eq('id', connectionId);
  }

  private async markManifestUploaded(
    connectionId: string,
    manifestVersion: string,
    dbtVersion: string
  ): Promise<void> {
    await supabase
      .schema('enterprise')
      .from('github_connections')
      .update({
        manifest_uploaded: true,
        manifest_version: manifestVersion,
        manifest_dbt_version: dbtVersion,
        extraction_tier: 'GOLD',
        last_extraction_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);
  }

  private async storeManifestData(
    connectionId: string,
    organizationId: string,
    parsed: any
  ): Promise<void> {
    console.log(`💾 Storing manifest data for connection: ${connectionId}`);
    console.log(`   Organization: ${organizationId}`);
    console.log(`   Models to store: ${parsed.models.length}`);
    
    // Get or create repository in metadata schema
    const { data: repo, error: repoError } = await supabase
      .schema('metadata')
      .from('repositories')
      .select('id')
      .eq('connection_id', connectionId)
      .single();

    if (repoError && repoError.code !== 'PGRST116') {
      console.error('❌ Error fetching repository:', repoError);
      throw new Error(`Failed to fetch repository: ${repoError.message}`);
    }

    let repositoryId = repo?.id;

    if (!repositoryId) {
      console.log('📁 Creating new repository record...');
      const { data: newRepo, error: insertError } = await supabase
        .schema('metadata')
        .from('repositories')
        .insert({
          organization_id: organizationId,
          connection_id: connectionId,
          path: '/models',
          name: 'dbt_models',
          type: 'dbt_project'
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error('❌ Error creating repository:', insertError);
        throw new Error(`Failed to create repository: ${insertError.message}`);
      }
      
      repositoryId = newRepo?.id;
      console.log(`✅ Repository created: ${repositoryId}`);
    } else {
      console.log(`✅ Using existing repository: ${repositoryId}`);
    }

    // Store models
    console.log(`📦 Storing ${parsed.models.length} models...`);
    for (const model of parsed.models) {
      console.log(`   Processing model: ${model.name}`);
      
      const { data: file, error: fileError } = await supabase
        .schema('metadata')
        .from('files')
        .upsert({
          repository_id: repositoryId,
          organization_id: organizationId,
          connection_id: connectionId,
          relative_path: `models/${model.name}.sql`,
          absolute_path: `/models/${model.name}.sql`,
          file_type: 'dbt',
          dialect: 'sql',
          parser_used: 'dbt-manifest',
          parse_confidence: 1.0
        }, {
          onConflict: 'organization_id,absolute_path'
        })
        .select('id')
        .single();

      if (fileError) {
        console.error(`   ❌ Error creating file for ${model.name}:`, fileError);
        continue;
      }

      if (file) {
        console.log(`   ✅ File created: ${file.id}`);
        
        const { data: object, error: objectError } = await supabase
          .schema('metadata')
          .from('objects')
          .insert({
            file_id: file.id,
            repository_id: repositoryId,
            organization_id: organizationId,
            connection_id: connectionId,
            name: model.name,
            schema_name: model.schema,
            database_name: model.database,
            object_type: model.object_type,
            definition: model.raw_sql,
            compiled_definition: model.compiled_sql,
            extracted_from: 'manifest',
            extraction_tier: 'GOLD',
            confidence: 1.0,
            metadata: {
              tags: model.tags,
              unique_id: model.unique_id,
              description: model.description
            }
          })
          .select('id')
          .single();

        if (objectError) {
          console.error(`   ❌ Error creating object for ${model.name}:`, objectError);
          continue;
        }
        
        console.log(`   ✅ Object created: ${object?.id}`);

        if (object) {
          for (const col of model.columns) {
            await supabase
              .schema('metadata')
              .from('columns')
              .insert({
                object_id: object.id,
                organization_id: organizationId,
                name: col.name,
                data_type: col.data_type,
                position: col.position,
                description: col.description
              });
          }
        }
      }
    }

    // Store sources (similar pattern)
    for (const source of parsed.sources) {
      const { data: file } = await supabase
        .schema('metadata')
        .from('files')
        .upsert({
          repository_id: repositoryId,
          organization_id: organizationId,
          connection_id: connectionId,
          relative_path: `sources/${source.source_name}/${source.name}.yml`,
          absolute_path: `/sources/${source.source_name}/${source.name}.yml`,
          file_type: 'dbt',
          dialect: 'sql',
          parser_used: 'dbt-manifest',
          parse_confidence: 1.0
        }, {
          onConflict: 'organization_id,absolute_path'
        })
        .select('id')
        .single();

      if (file) {
        const { data: object } = await supabase
          .schema('metadata')
          .from('objects')
          .insert({
            file_id: file.id,
            repository_id: repositoryId,
            organization_id: organizationId,
            connection_id: connectionId,
            name: source.name,
            schema_name: source.schema,
            database_name: source.database,
            object_type: 'source',
            extracted_from: 'manifest',
            extraction_tier: 'GOLD',
            confidence: 1.0,
            metadata: {
              source_name: source.source_name,
              identifier: source.identifier,
              unique_id: source.unique_id
            }
          })
          .select('id')
          .single();

        if (object) {
          for (const col of source.columns) {
            await supabase
              .schema('metadata')
              .from('columns')
              .insert({
                object_id: object.id,
                organization_id: organizationId,
                name: col.name,
                data_type: col.data_type,
                description: col.description
              });
          }
        }
      }
    }

    // Store dependencies
    const objectMap = new Map<string, string>();
    const { data: allObjects } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, metadata')
      .eq('connection_id', connectionId);

    if (allObjects) {
      for (const obj of allObjects) {
        const uniqueId = obj.metadata?.unique_id;
        if (uniqueId) {
          objectMap.set(uniqueId, obj.id);
        }
      }
    }

    for (const dep of parsed.dependencies) {
      const sourceId = objectMap.get(dep.source_unique_id);
      const targetId = objectMap.get(dep.target_unique_id);

      if (sourceId && targetId) {
        await supabase
          .schema('metadata')
          .from('dependencies')
          .upsert({
            organization_id: organizationId,
            source_object_id: sourceId,
            target_object_id: targetId,
            dependency_type: 'dbt_ref',
            confidence: dep.confidence,
            metadata: {
              extracted_from: 'manifest'
            }
          }, {
            onConflict: 'source_object_id,target_object_id,dependency_type,source_column,target_column'
          });
      }
    }

    console.log(`✅ All data stored in database`);
  }
}
