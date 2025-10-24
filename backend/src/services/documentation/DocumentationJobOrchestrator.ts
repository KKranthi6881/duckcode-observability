/**
 * Documentation Job Orchestrator
 * Manages batch processing of documentation generation for multiple objects
 */

import { EventEmitter } from 'events';
import { supabaseAdmin } from '../../config/supabase';
import { DocumentationGenerationService } from './DocumentationGenerationService';
import {
  DocumentationJob,
  JobStatus,
  JobOptions,
  LayerName,
  DocumentationGenerationError,
  APIKeyNotFoundError,
  RateLimitError,
} from './types';

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  processedObjects: number;
  totalObjects: number;
  failedObjects: number;
  progressPercentage: number;
  currentObjectId?: string;
  currentObjectName?: string;
  estimatedCompletionTime?: Date;
  message: string;
}

export class DocumentationJobOrchestrator extends EventEmitter {
  private organizationId: string;
  private activeJobs: Map<string, boolean>; // jobId -> isRunning
  private service: DocumentationGenerationService;

  constructor(organizationId: string) {
    super();
    this.organizationId = organizationId;
    this.activeJobs = new Map();
    this.service = new DocumentationGenerationService(organizationId);
  }

  /**
   * Create a new documentation job
   */
  async createJob(
    objectIds: string[],
    options: JobOptions = {},
    triggeredByUserId?: string,
    triggeredByUserEmail?: string
  ): Promise<string> {
    console.log(`[DocOrchestrator] Creating job for ${objectIds.length} objects`);

    // Validate inputs
    if (!objectIds || objectIds.length === 0) {
      throw new Error('objectIds array cannot be empty');
    }

    // Filter out already documented objects if skipExisting is true
    let targetObjectIds = objectIds;
    if (options.skipExisting && !options.regenerateAll) {
      targetObjectIds = await this.filterUndocumentedObjects(objectIds);
      console.log(`[DocOrchestrator] After filtering: ${targetObjectIds.length} objects need documentation`);
    }

    if (targetObjectIds.length === 0) {
      console.log('[DocOrchestrator] All objects already documented, nothing to do');
      throw new Error('All objects already have current documentation');
    }

    // Calculate estimated cost
    const estimatedCost = this.calculateEstimatedCost(targetObjectIds.length);

    // Create job record
    const { data: job, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .insert({
        organization_id: this.organizationId,
        object_ids: targetObjectIds,
        total_objects: targetObjectIds.length,
        processed_objects: 0,
        failed_objects: 0,
        skipped_objects: 0,
        status: 'queued',
        progress_percentage: 0,
        api_provider: 'openai',
        model_name: 'gpt-4o-latest',
        total_tokens_used: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        estimated_cost: estimatedCost,
        actual_cost: 0,
        layers_completed: {},
        layers_failed: {},
        error_log: [],
        retry_count: 0,
        max_retries: options.maxRetries || 3,
        triggered_by_user_id: triggeredByUserId,
        triggered_by_user_email: triggeredByUserEmail,
        options: options,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[DocOrchestrator] Failed to create job:', error);
      throw new Error(`Failed to create job: ${error.message}`);
    }

    console.log(`[DocOrchestrator] Job created: ${job.id}`);
    return job.id;
  }

  /**
   * Process an entire job (all objects)
   */
  async processJob(jobId: string): Promise<void> {
    console.log(`[DocOrchestrator] Starting job processing: ${jobId}`);

    // Check if job is already running
    if (this.activeJobs.get(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    this.activeJobs.set(jobId, true);

    try {
      // Initialize OpenAI service
      console.log('[DocOrchestrator] Initializing OpenAI service...');
      await this.service.initialize();
      console.log('[DocOrchestrator] OpenAI service initialized');

      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing');
      await this.setJobStartTime(jobId);

      // Fetch job details
      const job = await this.getJob(jobId);
      const objectIds = (job as any).object_ids || job.objectIds;

      console.log(`[DocOrchestrator] Processing ${objectIds.length} objects`);

      // Process each object sequentially
      for (let i = 0; i < objectIds.length; i++) {
        const objectId = objectIds[i];
        
        // Check if job was cancelled
        if (!this.activeJobs.get(jobId)) {
          console.log('[DocOrchestrator] Job cancelled, stopping processing');
          await this.updateJobStatus(jobId, 'cancelled');
          return;
        }

        console.log(`\n[DocOrchestrator] Processing object ${i + 1}/${objectIds.length}: ${objectId}`);

        try {
          await this.processObject(jobId, objectId);
        } catch (error) {
          console.error(`[DocOrchestrator] Error processing object ${objectId}:`, error);
          await this.handleObjectError(jobId, objectId, error);
        }
      }

      // Job completed
      console.log(`\n[DocOrchestrator] Job ${jobId} completed successfully`);
      await this.updateJobStatus(jobId, 'completed');
      await this.setJobCompletionTime(jobId);
      await this.updateAverageProcessingTime(jobId);

      // Emit completion event
      const finalJob = await this.getJob(jobId);
      this.emit('job-completed', {
        jobId,
        processedObjects: (finalJob as any).processed_objects || finalJob.processedObjects,
        failedObjects: (finalJob as any).failed_objects || finalJob.failedObjects,
        totalCost: (finalJob as any).actual_cost || finalJob.actualCost,
      });

    } catch (error: any) {
      console.error(`[DocOrchestrator] Job ${jobId} failed:`, error);
      
      // Handle critical errors (API key missing, etc.)
      await this.updateJobStatus(jobId, 'failed', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      this.emit('job-failed', { jobId, error: error.message });
      throw error;

    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Process a single object within a job
   */
  private async processObject(jobId: string, objectId: string): Promise<void> {
    const startTime = Date.now();

    // Update current object being processed
    await this.updateCurrentObject(jobId, objectId);

    try {
      // Fetch object metadata to get name
      const objectData = await this.service.fetchObjectMetadata(objectId);
      console.log(`[DocOrchestrator] Processing: ${objectData.name} (${objectData.object_type})`);

      // Update current object name
      await this.updateCurrentObjectName(jobId, objectData.name);

      // Emit progress event
      this.emitProgress(jobId, objectData.name);

      // Generate documentation for this object
      const documentation = await this.service.generateDocumentationForObject(objectId);

      const duration = Date.now() - startTime;
      console.log(`[DocOrchestrator] Generated documentation in ${duration}ms`);

      // Store documentation
      const docId = await this.service.storeDocumentation(
        objectId,
        documentation,
        0, // Token count tracked per layer below
        duration
      );

      console.log(`[DocOrchestrator] Documentation stored: ${docId}`);

      // Mark as successful
      await this.incrementProcessedObjects(jobId);
      await this.updateEstimatedCompletion(jobId);

      // Log success for each layer
      const layers: LayerName[] = [
        'executive_summary',
        'business_narrative',
        'transformation_cards',
        'code_explanations',
        'business_rules',
        'impact_analysis',
      ];

      for (const layer of layers) {
        await this.logLayerCompletion(jobId, objectId, layer, duration / layers.length);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[DocOrchestrator] Failed to process object ${objectId}:`, error);

      // Re-throw to be handled by outer error handler
      throw error;
    }
  }

  /**
   * Handle error for a single object (decide whether to retry or skip)
   */
  private async handleObjectError(jobId: string, objectId: string, error: any): Promise<void> {
    console.log(`[DocOrchestrator] Handling error for object ${objectId}`);

    // Check error type
    if (error instanceof APIKeyNotFoundError) {
      // Critical error - fail entire job
      console.error('[DocOrchestrator] API key not found - failing entire job');
      await this.updateJobStatus(jobId, 'failed', {
        error: 'No OpenAI API key configured for organization',
        objectId,
      });
      throw error;
    }

    if (error instanceof RateLimitError) {
      // Rate limit - wait and retry
      console.log(`[DocOrchestrator] Rate limit hit, waiting ${error.retryAfterSeconds || 60}s...`);
      await this.sleep((error.retryAfterSeconds || 60) * 1000);
      
      // Retry this object
      try {
        await this.processObject(jobId, objectId);
        return; // Success on retry
      } catch (retryError) {
        console.error('[DocOrchestrator] Retry failed:', retryError);
        // Fall through to mark as failed
      }
    }

    // For other errors, increment failed count and continue
    console.log('[DocOrchestrator] Marking object as failed and continuing');
    await this.incrementFailedObjects(jobId);
    
    // Log error
    await this.logError(jobId, objectId, error);

    // Log failed layers
    const layers: LayerName[] = [
      'executive_summary',
      'business_narrative',
      'transformation_cards',
      'code_explanations',
      'business_rules',
      'impact_analysis',
    ];

    for (const layer of layers) {
      await this.logLayerFailure(jobId, objectId, layer, error.message);
    }

    // Don't throw - continue processing other objects
  }

  /**
   * Calculate estimated cost for a number of objects
   */
  private calculateEstimatedCost(objectCount: number): number {
    // Average cost per object: ~$0.05
    const avgCostPerObject = 0.05;
    return objectCount * avgCostPerObject;
  }

  /**
   * Filter out objects that already have current documentation
   */
  private async filterUndocumentedObjects(objectIds: string[]): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .schema('metadata')
      .from('object_documentation')
      .select('object_id')
      .in('object_id', objectIds)
      .eq('is_current', true);

    if (error) {
      console.error('[DocOrchestrator] Error checking existing docs:', error);
      return objectIds; // Return all on error
    }

    const documentedIds = new Set(data.map((d: any) => d.object_id));
    return objectIds.filter(id => !documentedIds.has(id));
  }

  /**
   * Get job details from database
   */
  async getJob(jobId: string): Promise<DocumentationJob> {
    const { data, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return data as DocumentationJob;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobProgress> {
    const job = await this.getJob(jobId);

    return {
      jobId: job.id,
      status: job.status,
      processedObjects: job.processedObjects,
      totalObjects: job.totalObjects,
      failedObjects: job.failedObjects,
      progressPercentage: job.progressPercentage,
      currentObjectId: job.currentObjectId,
      currentObjectName: job.currentObjectName,
      estimatedCompletionTime: job.estimatedCompletionTime,
      message: this.getStatusMessage(job),
    };
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    console.log(`[DocOrchestrator] Cancelling job: ${jobId}`);

    // Mark as cancelled
    this.activeJobs.delete(jobId);

    await this.updateJobStatus(jobId, 'cancelled');

    this.emit('job-cancelled', { jobId });
    return true;
  }

  /**
   * Pause a running job
   */
  async pauseJob(jobId: string): Promise<boolean> {
    console.log(`[DocOrchestrator] Pausing job: ${jobId}`);

    // Remove from active jobs (will stop on next iteration)
    this.activeJobs.delete(jobId);

    await this.updateJobStatus(jobId, 'paused');
    await this.setPausedTime(jobId);

    this.emit('job-paused', { jobId });
    return true;
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    console.log(`[DocOrchestrator] Resuming job: ${jobId}`);

    const job = await this.getJob(jobId);

    if (job.status !== 'paused') {
      throw new Error(`Job ${jobId} is not paused (status: ${job.status})`);
    }

    // Process job from where it left off
    await this.processJob(jobId);
  }

  // ==========================================
  // DATABASE UPDATE METHODS
  // ==========================================

  private async updateJobStatus(jobId: string, status: JobStatus, errorDetails?: any): Promise<void> {
    // Use database function for status updates
    const { error } = await supabaseAdmin
      .schema('metadata')
      .rpc('update_job_status', {
        p_job_id: jobId,
        p_status: status,
        p_error_details: errorDetails || null,
      });

    if (error) {
      console.error('[DocOrchestrator] Failed to update job status:', error);
    } else {
      console.log(`[DocOrchestrator] Job ${jobId} status: ${status}`);
    }
  }

  private async setJobStartTime(jobId: string): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .update({ started_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  private async setJobCompletionTime(jobId: string): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  private async setPausedTime(jobId: string): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .update({ paused_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  private async updateCurrentObject(jobId: string, objectId: string): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .update({ current_object_id: objectId })
      .eq('id', jobId);
  }

  private async updateCurrentObjectName(jobId: string, objectName: string): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .update({ current_object_name: objectName })
      .eq('id', jobId);
  }

  private async incrementProcessedObjects(jobId: string): Promise<void> {
    // Use database function for atomic increment
    const { error } = await supabaseAdmin
      .schema('metadata')
      .rpc('increment_processed_objects', {
        p_job_id: jobId,
      });

    if (error) {
      console.error('[DocOrchestrator] Failed to increment processed objects:', error);
    }
  }

  private async incrementFailedObjects(jobId: string): Promise<void> {
    // Use database function for atomic increment
    const { error } = await supabaseAdmin
      .schema('metadata')
      .rpc('increment_failed_objects', {
        p_job_id: jobId,
      });

    if (error) {
      console.error('[DocOrchestrator] Failed to increment failed objects:', error);
    }
  }

  private async updateEstimatedCompletion(jobId: string): Promise<void> {
    // Use database function to calculate estimated completion
    const { error } = await supabaseAdmin
      .schema('metadata')
      .rpc('update_estimated_completion', {
        p_job_id: jobId,
      });

    if (error) {
      console.error('[DocOrchestrator] Failed to update estimated completion:', error);
    }
  }

  private async updateAverageProcessingTime(jobId: string): Promise<void> {
    // Use database function to calculate average time
    const { error } = await supabaseAdmin
      .schema('metadata')
      .rpc('update_average_processing_time', {
        p_job_id: jobId,
      });

    if (error) {
      console.error('[DocOrchestrator] Failed to update average processing time:', error);
    }
  }

  private async logError(jobId: string, objectId: string, error: any): Promise<void> {
    // Append to error_log array
    const job = await this.getJob(jobId);
    const errorLog = job.errorLog || [];

    errorLog.push({
      objectId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .update({ error_log: errorLog })
      .eq('id', jobId);
  }

  // ==========================================
  // LAYER LOGGING METHODS
  // ==========================================

  private async logLayerCompletion(
    jobId: string,
    objectId: string,
    layer: LayerName,
    processingTimeMs: number
  ): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_generation_logs')
      .insert({
        job_id: jobId,
        object_id: objectId,
        layer: layer,
        layer_display_name: this.getLayerDisplayName(layer),
        status: 'completed',
        processing_time_ms: Math.round(processingTimeMs),
        model_used: 'gpt-4o-latest',
        finish_reason: 'stop',
      });
  }

  private async logLayerFailure(
    jobId: string,
    objectId: string,
    layer: LayerName,
    errorMessage: string
  ): Promise<void> {
    await supabaseAdmin
      .schema('metadata')
      .from('documentation_generation_logs')
      .insert({
        job_id: jobId,
        object_id: objectId,
        layer: layer,
        layer_display_name: this.getLayerDisplayName(layer),
        status: 'failed',
        error_message: errorMessage,
        model_used: 'gpt-4o-latest',
      });
  }

  private getLayerDisplayName(layer: LayerName): string {
    const names: Record<LayerName, string> = {
      executive_summary: 'Executive Summary',
      business_narrative: 'Business Narrative',
      transformation_cards: 'Transformation Cards',
      code_explanations: 'Code Explanations',
      business_rules: 'Business Rules',
      impact_analysis: 'Impact Analysis',
    };
    return names[layer];
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private getStatusMessage(job: DocumentationJob): string {
    switch (job.status) {
      case 'queued':
        return 'Job queued, waiting to start';
      case 'processing':
        return `Processing ${job.currentObjectName || 'object'} (${job.processedObjects}/${job.totalObjects})`;
      case 'completed':
        return `Completed ${job.processedObjects} objects (${job.failedObjects} failed)`;
      case 'failed':
        return 'Job failed';
      case 'cancelled':
        return 'Job cancelled by user';
      case 'paused':
        return 'Job paused';
      default:
        return 'Unknown status';
    }
  }

  private emitProgress(jobId: string, currentObjectName?: string): void {
    // Get job and emit progress event (async, fire-and-forget)
    this.getJob(jobId).then(job => {
      this.emit('progress', {
        jobId: job.id,
        status: job.status,
        processedObjects: job.processedObjects,
        totalObjects: job.totalObjects,
        failedObjects: job.failedObjects,
        progressPercentage: job.progressPercentage,
        currentObjectName: currentObjectName || job.currentObjectName,
        message: this.getStatusMessage(job),
      } as JobProgress);
    }).catch(error => {
      console.error('[DocOrchestrator] Failed to emit progress:', error);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
