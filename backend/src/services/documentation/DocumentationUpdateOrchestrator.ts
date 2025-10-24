import { supabaseAdmin } from '../../config/supabase';
import { MetadataChangeDetector, ChangeReport } from '../metadata/MetadataChangeDetector';
import { DocumentationJobOrchestrator } from './DocumentationJobOrchestrator';

/**
 * Orchestrates automatic documentation updates when metadata changes
 * Triggered by webhooks after metadata extraction completes
 */
export class DocumentationUpdateOrchestrator {
  private changeDetector: MetadataChangeDetector;

  constructor() {
    this.changeDetector = new MetadataChangeDetector();
  }

  /**
   * Handle metadata changes and trigger documentation updates
   * Called after metadata extraction completes
   */
  async handleMetadataChange(
    connectionId: string,
    organizationId: string,
    webhookEventId?: string
  ): Promise<void> {
    console.log(`[DocUpdateOrchestrator] Checking for documentation updates...`);
    console.log(`  Connection: ${connectionId}`);
    console.log(`  Organization: ${organizationId}`);

    try {
      // 1. Check if auto-update is enabled for this organization
      const isEnabled = await this.isAutoUpdateEnabled(organizationId);
      
      if (!isEnabled) {
        console.log(`[DocUpdateOrchestrator] Auto-update disabled for organization`);
        return;
      }

      // 2. Detect changes in metadata
      console.log(`[DocUpdateOrchestrator] Detecting metadata changes...`);
      const changes = await this.changeDetector.detectChanges(connectionId, organizationId);

      // 3. If no changes, skip
      if (changes.summary.totalChanges === 0) {
        console.log(`[DocUpdateOrchestrator] No changes detected, skipping documentation update`);
        
        await this.logUpdateEvent({
          organizationId,
          connectionId,
          webhookEventId,
          changes,
          status: 'skipped',
          reason: 'no_changes'
        });
        
        return;
      }

      // 4. Filter to only objects that need documentation updates
      console.log(`[DocUpdateOrchestrator] Filtering documentable changes...`);
      const objectsToUpdate = await this.changeDetector.filterDocumentableChanges(
        changes,
        organizationId
      );

      if (objectsToUpdate.length === 0) {
        console.log(`[DocUpdateOrchestrator] No objects need documentation updates`);
        
        await this.logUpdateEvent({
          organizationId,
          connectionId,
          webhookEventId,
          changes,
          status: 'skipped',
          reason: 'no_documentable_changes'
        });
        
        return;
      }

      // 5. Check daily limit
      const dailyCount = await this.getDailyUpdateCount(organizationId);
      const { data: settings } = await supabaseAdmin
        .schema('enterprise')
        .from('organization_settings')
        .select('max_auto_updates_per_day')
        .eq('organization_id', organizationId)
        .single();

      const maxDaily = settings?.max_auto_updates_per_day || 100;
      
      if (dailyCount >= maxDaily) {
        console.log(`[DocUpdateOrchestrator] Daily limit reached (${dailyCount}/${maxDaily})`);
        
        await this.logUpdateEvent({
          organizationId,
          connectionId,
          webhookEventId,
          changes,
          status: 'skipped',
          reason: 'daily_limit_reached'
        });
        
        return;
      }

      // 6. Create documentation job for changed objects
      console.log(`[DocUpdateOrchestrator] Creating documentation job for ${objectsToUpdate.length} objects...`);
      
      const jobId = await this.createDocumentationJob(
        organizationId,
        objectsToUpdate,
        webhookEventId
      );

      console.log(`[DocUpdateOrchestrator] ✅ Documentation job created: ${jobId}`);

      // 7. Log update event
      await this.logUpdateEvent({
        organizationId,
        connectionId,
        webhookEventId,
        changes,
        jobId,
        status: 'completed',
        objectCount: objectsToUpdate.length
      });

    } catch (error: any) {
      console.error('[DocUpdateOrchestrator] Error handling metadata change:', error);
      
      // Log failed update event
      await this.logUpdateEvent({
        organizationId,
        connectionId,
        webhookEventId,
        changes: { 
          added: [], 
          modified: [], 
          deleted: [], 
          unchanged: [],
          summary: { totalChanges: 0, addedCount: 0, modifiedCount: 0, deletedCount: 0, unchangedCount: 0 }
        },
        status: 'failed',
        error: error.message
      });
    }
  }

  /**
   * Check if auto-update is enabled for organization
   */
  private async isAutoUpdateEnabled(organizationId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_settings')
      .select('auto_update_documentation')
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) {
      // Default to false if not configured
      return false;
    }

    return data.auto_update_documentation === true;
  }

  /**
   * Get count of auto-updates today
   */
  private async getDailyUpdateCount(organizationId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_update_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('triggered_by', 'webhook')
      .gte('created_at', today.toISOString());

    return count || 0;
  }

  /**
   * Create documentation job for auto-update
   */
  private async createDocumentationJob(
    organizationId: string,
    objectIds: string[],
    webhookEventId?: string
  ): Promise<string> {
    // Note: This would ideally call the DocumentationJobOrchestrator
    // For now, we'll create a job record directly
    // In production, integrate with your existing job system

    const { data, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .insert({
        organization_id: organizationId,
        object_ids: objectIds,
        mode: 'auto-update',
        status: 'pending',
        total_objects: objectIds.length,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create documentation job: ${error.message}`);
    }

    // TODO: Trigger the actual job execution
    // await this.jobOrchestrator.executeJob(data.id);

    return data.id;
  }

  /**
   * Log documentation update event
   */
  private async logUpdateEvent(params: {
    organizationId: string;
    connectionId: string;
    webhookEventId?: string;
    changes: ChangeReport;
    jobId?: string;
    status: 'pending' | 'completed' | 'failed' | 'skipped';
    reason?: string;
    error?: string;
    objectCount?: number;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .schema('metadata')
        .from('documentation_update_events')
        .insert({
          organization_id: params.organizationId,
          repository_id: null, // Could be derived from connectionId if needed
          job_id: params.jobId || null,
          webhook_event_id: params.webhookEventId || null,
          objects_added: params.changes.summary.addedCount,
          objects_modified: params.changes.summary.modifiedCount,
          objects_deleted: params.changes.summary.deletedCount,
          objects_unchanged: params.changes.summary.unchangedCount,
          triggered_by: 'webhook',
          trigger_event: 'git_push',
          status: params.status,
          error_message: params.error || null,
          created_at: new Date().toISOString(),
          started_at: params.status !== 'skipped' ? new Date().toISOString() : null,
          completed_at: params.status === 'completed' ? new Date().toISOString() : null
        });

      console.log(`[DocUpdateOrchestrator] Update event logged: ${params.status}`);
    } catch (error) {
      console.error('[DocUpdateOrchestrator] Error logging update event:', error);
      // Don't throw - logging failure shouldn't fail the whole process
    }
  }

  /**
   * Get organization settings with defaults
   */
  async getOrganizationSettings(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        auto_update_documentation: false,
        max_auto_updates_per_day: 100,
        notify_on_update: true
      };
    }

    return data;
  }
}
