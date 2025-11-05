import cron from 'node-cron';
import SnowflakeDataSyncService from '../services/SnowflakeDataSyncService';
import AlertNotificationService from '../services/AlertNotificationService';
import BudgetTrackingService from '../services/BudgetTrackingService';

export class JobScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled jobs
   */
  async start(): Promise<void> {
    console.log('[Scheduler] Starting job scheduler...');

    // Job 1: Sync Snowflake data daily at 2 AM
    this.scheduleSnowflakeSync();

    // Job 2: Check budget alerts every hour
    this.scheduleBudgetAlertChecks();

    // Job 3: Process pending notifications every 5 minutes
    this.scheduleNotificationProcessing();

    // Job 4: Create daily budget snapshots at midnight
    this.scheduleBudgetSnapshots();

    console.log(`[Scheduler] ✓ Started ${this.jobs.size} scheduled jobs`);
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log('[Scheduler] Stopping all scheduled jobs...');
    this.jobs.forEach((task, name) => {
      task.stop();
      console.log(`[Scheduler] ✓ Stopped job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Schedule Snowflake data sync - Daily at 2 AM
   */
  private scheduleSnowflakeSync(): void {
    const jobName = 'snowflake-sync';
    
    // Run daily at 2 AM: '0 2 * * *'
    const task = cron.schedule('0 2 * * *', async () => {
      console.log(`[Scheduler] Running job: ${jobName}`);
      try {
        const results = await SnowflakeDataSyncService.syncAllConnectors();
        const successCount = results.filter(r => r.success).length;
        const totalRecords = results.reduce((sum, r) => sum + r.records_synced, 0);
        
        console.log(`[Scheduler] ✓ ${jobName} completed: ${successCount}/${results.length} connectors, ${totalRecords} records synced`);
      } catch (err) {
        console.error(`[Scheduler] ✗ ${jobName} failed:`, err);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Chicago',
    });

    this.jobs.set(jobName, task);
    console.log(`[Scheduler] ✓ Scheduled: ${jobName} (Daily at 2 AM)`);
  }

  /**
   * Schedule budget alert checks - Every hour
   */
  private scheduleBudgetAlertChecks(): void {
    const jobName = 'budget-alert-check';
    
    // Run every hour: '0 * * * *'
    const task = cron.schedule('0 * * * *', async () => {
      console.log(`[Scheduler] Running job: ${jobName}`);
      try {
        // Get all active budgets
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        const { data: budgets } = await supabase
          .schema('enterprise')
          .from('snowflake_budgets')
          .select('id')
          .eq('status', 'active');

        if (!budgets || budgets.length === 0) {
          console.log(`[Scheduler] No active budgets to check`);
          return;
        }

        // Check alerts for each budget
        let alertsCreated = 0;
        for (const budget of budgets) {
          try {
            await BudgetTrackingService.checkBudgetAlerts(budget.id);
            alertsCreated++;
          } catch (err) {
            console.error(`[Scheduler] Error checking alerts for budget ${budget.id}:`, err);
          }
        }

        console.log(`[Scheduler] ✓ ${jobName} completed: Checked ${budgets.length} budgets`);
      } catch (err) {
        console.error(`[Scheduler] ✗ ${jobName} failed:`, err);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Chicago',
    });

    this.jobs.set(jobName, task);
    console.log(`[Scheduler] ✓ Scheduled: ${jobName} (Every hour)`);
  }

  /**
   * Schedule notification processing - Every 5 minutes
   */
  private scheduleNotificationProcessing(): void {
    const jobName = 'notification-processing';
    
    // Run every 5 minutes: '*/5 * * * *'
    const task = cron.schedule('*/5 * * * *', async () => {
      console.log(`[Scheduler] Running job: ${jobName}`);
      try {
        const results = await AlertNotificationService.processPendingAlerts();
        const successCount = results.filter(r => r.email_sent || r.slack_sent).length;
        
        console.log(`[Scheduler] ✓ ${jobName} completed: ${successCount}/${results.length} notifications sent`);
      } catch (err) {
        console.error(`[Scheduler] ✗ ${jobName} failed:`, err);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Chicago',
    });

    this.jobs.set(jobName, task);
    console.log(`[Scheduler] ✓ Scheduled: ${jobName} (Every 5 minutes)`);
  }

  /**
   * Schedule budget snapshots - Daily at midnight
   */
  private scheduleBudgetSnapshots(): void {
    const jobName = 'budget-snapshots';
    
    // Run daily at midnight: '0 0 * * *'
    const task = cron.schedule('0 0 * * *', async () => {
      console.log(`[Scheduler] Running job: ${jobName}`);
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        const { data: budgets } = await supabase
          .schema('enterprise')
          .from('snowflake_budgets')
          .select('id')
          .eq('status', 'active');

        if (!budgets || budgets.length === 0) {
          console.log(`[Scheduler] No active budgets for snapshots`);
          return;
        }

        // Create snapshot for each budget
        let snapshotsCreated = 0;
        for (const budget of budgets) {
          try {
            await BudgetTrackingService.createSnapshot(budget.id);
            snapshotsCreated++;
          } catch (err) {
            console.error(`[Scheduler] Error creating snapshot for budget ${budget.id}:`, err);
          }
        }

        console.log(`[Scheduler] ✓ ${jobName} completed: Created ${snapshotsCreated} snapshots`);
      } catch (err) {
        console.error(`[Scheduler] ✗ ${jobName} failed:`, err);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Chicago',
    });

    this.jobs.set(jobName, task);
    console.log(`[Scheduler] ✓ Scheduled: ${jobName} (Daily at midnight)`);
  }

  /**
   * Run a job manually (for testing)
   */
  async runManually(jobName: string): Promise<void> {
    console.log(`[Scheduler] Manually running job: ${jobName}`);

    switch (jobName) {
      case 'snowflake-sync':
        const syncResults = await SnowflakeDataSyncService.syncAllConnectors();
        console.log('[Scheduler] Manual sync results:', syncResults);
        break;

      case 'budget-alert-check':
        // Implementation same as scheduled version
        console.log('[Scheduler] Manual alert check not implemented');
        break;

      case 'notification-processing':
        const notifResults = await AlertNotificationService.processPendingAlerts();
        console.log('[Scheduler] Manual notification results:', notifResults);
        break;

      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Get status of all jobs
   */
  getStatus(): Array<{ name: string; running: boolean; schedule: string }> {
    return [
      {
        name: 'snowflake-sync',
        running: this.jobs.has('snowflake-sync'),
        schedule: 'Daily at 2 AM',
      },
      {
        name: 'budget-alert-check',
        running: this.jobs.has('budget-alert-check'),
        schedule: 'Every hour',
      },
      {
        name: 'notification-processing',
        running: this.jobs.has('notification-processing'),
        schedule: 'Every 5 minutes',
      },
      {
        name: 'budget-snapshots',
        running: this.jobs.has('budget-snapshots'),
        schedule: 'Daily at midnight',
      },
    ];
  }
}

export default new JobScheduler();
