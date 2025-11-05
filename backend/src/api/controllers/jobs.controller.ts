import { Request, Response } from 'express';
import JobScheduler from '../../jobs/scheduler';
import SnowflakeDataSyncService from '../../services/SnowflakeDataSyncService';
import AlertNotificationService from '../../services/AlertNotificationService';

export class JobsController {
  /**
   * GET /api/jobs/status
   * Get status of all scheduled jobs
   */
  async getStatus(req: Request, res: Response) {
    try {
      const status = JobScheduler.getStatus();
      
      return res.status(200).json({
        success: true,
        jobs: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[JobsController] Error getting status:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get job status',
      });
    }
  }

  /**
   * POST /api/jobs/run/:jobName
   * Manually trigger a job
   */
  async runJob(req: Request, res: Response) {
    try {
      const { jobName } = req.params;
      
      console.log(`[JobsController] Manually triggering job: ${jobName}`);

      switch (jobName) {
        case 'snowflake-sync':
          const syncResults = await SnowflakeDataSyncService.syncAllConnectors();
          return res.status(200).json({
            success: true,
            job: jobName,
            results: syncResults,
            message: `Synced ${syncResults.length} connectors`,
          });

        case 'notification-processing':
          const notifResults = await AlertNotificationService.processPendingAlerts();
          return res.status(200).json({
            success: true,
            job: jobName,
            results: notifResults,
            message: `Processed ${notifResults.length} notifications`,
          });

        case 'budget-alert-check':
          // This would need to be implemented similar to the scheduler
          return res.status(501).json({
            error: 'Budget alert check not yet implemented for manual trigger',
          });

        default:
          return res.status(404).json({
            error: `Unknown job: ${jobName}`,
            available_jobs: ['snowflake-sync', 'notification-processing', 'budget-alert-check'],
          });
      }
    } catch (error: any) {
      console.error('[JobsController] Error running job:', error);
      return res.status(500).json({
        error: error.message || 'Failed to run job',
      });
    }
  }

  /**
   * POST /api/jobs/sync-connector/:connectorId
   * Manually sync a specific connector
   */
  async syncConnector(req: Request, res: Response) {
    try {
      const { connectorId } = req.params;
      
      console.log(`[JobsController] Syncing connector: ${connectorId}`);
      
      const result = await SnowflakeDataSyncService.syncConnector(connectorId);
      
      return res.status(200).json({
        success: true,
        result,
        message: `Synced ${result.records_synced} records`,
      });
    } catch (error: any) {
      console.error('[JobsController] Error syncing connector:', error);
      return res.status(500).json({
        error: error.message || 'Failed to sync connector',
      });
    }
  }

  /**
   * POST /api/jobs/test-email
   * Test email configuration
   */
  async testEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          error: 'Email address is required',
        });
      }

      // Create test alert
      const testAlert = {
        id: 'test-alert',
        budget_id: 'test-budget',
        budget_name: 'Test Budget',
        alert_type: 'threshold_1' as const,
        threshold_percentage: 75,
        current_spend: 750,
        budget_amount: 1000,
        percentage_used: 75,
        budget_period: 'monthly',
        remaining_budget: 250,
      };

      const result = await AlertNotificationService.sendAlert(testAlert, {
        emails: [email],
      });

      return res.status(200).json({
        success: result.email_sent,
        message: result.email_sent ? 'Test email sent successfully' : 'Failed to send test email',
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('[JobsController] Error sending test email:', error);
      return res.status(500).json({
        error: error.message || 'Failed to send test email',
      });
    }
  }

  /**
   * POST /api/jobs/test-slack
   * Test Slack webhook
   */
  async testSlack(req: Request, res: Response) {
    try {
      const { webhook_url } = req.body;
      
      if (!webhook_url) {
        return res.status(400).json({
          error: 'Webhook URL is required',
        });
      }

      // Create test alert
      const testAlert = {
        id: 'test-alert',
        budget_id: 'test-budget',
        budget_name: 'Test Budget',
        alert_type: 'threshold_1' as const,
        threshold_percentage: 75,
        current_spend: 750,
        budget_amount: 1000,
        percentage_used: 75,
        budget_period: 'monthly',
        remaining_budget: 250,
      };

      const result = await AlertNotificationService.sendAlert(testAlert, {
        slack_webhook: webhook_url,
      });

      return res.status(200).json({
        success: result.slack_sent,
        message: result.slack_sent ? 'Test Slack message sent successfully' : 'Failed to send test Slack message',
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('[JobsController] Error sending test Slack:', error);
      return res.status(500).json({
        error: error.message || 'Failed to send test Slack message',
      });
    }
  }
}

export default new JobsController();
