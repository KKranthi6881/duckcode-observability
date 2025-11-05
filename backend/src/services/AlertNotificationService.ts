import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

interface Alert {
  id: string;
  budget_id: string;
  budget_name: string;
  alert_type: 'threshold_1' | 'threshold_2' | 'threshold_3' | 'exceeded';
  threshold_percentage: number;
  current_spend: number;
  budget_amount: number;
  percentage_used: number;
  budget_period: string;
  remaining_budget: number;
}

interface NotificationResult {
  alert_id: string;
  email_sent: boolean;
  slack_sent: boolean;
  errors: string[];
}

export class AlertNotificationService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Send alert notifications (email + Slack)
   */
  async sendAlert(alert: Alert, recipients: {
    emails?: string[];
    slack_webhook?: string;
  }): Promise<NotificationResult> {
    const errors: string[] = [];
    let emailSent = false;
    let slackSent = false;

    // Send email notifications
    if (recipients.emails && recipients.emails.length > 0) {
      try {
        await this.sendEmailAlert(alert, recipients.emails);
        emailSent = true;
        console.log(`[AlertNotification] ✓ Email sent to ${recipients.emails.length} recipients`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push(`Email failed: ${error}`);
        console.error('[AlertNotification] ✗ Email sending failed:', err);
      }
    }

    // Send Slack notification
    if (recipients.slack_webhook) {
      try {
        await this.sendSlackAlert(alert, recipients.slack_webhook);
        slackSent = true;
        console.log('[AlertNotification] ✓ Slack notification sent');
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push(`Slack failed: ${error}`);
        console.error('[AlertNotification] ✗ Slack sending failed:', err);
      }
    }

    // Record notification in database
    await this.recordNotification(alert.id, emailSent, slackSent);

    return {
      alert_id: alert.id,
      email_sent: emailSent,
      slack_sent: slackSent,
      errors,
    };
  }

  /**
   * Send Slack webhook notification
   */
  private async sendSlackAlert(alert: Alert, webhookUrl: string): Promise<void> {
    const emoji = this.getAlertEmoji(alert.alert_type);
    const color = this.getAlertColor(alert.alert_type);
    const severity = this.getAlertSeverity(alert.alert_type);

    const slackMessage = {
      text: `${emoji} *Budget Alert: ${alert.budget_name}*`,
      attachments: [
        {
          color: color,
          fields: [
            {
              title: 'Alert Type',
              value: severity,
              short: true,
            },
            {
              title: 'Threshold',
              value: `${alert.threshold_percentage}%`,
              short: true,
            },
            {
              title: 'Current Spend',
              value: `$${alert.current_spend.toFixed(2)}`,
              short: true,
            },
            {
              title: 'Budget Amount',
              value: `$${alert.budget_amount.toFixed(2)}`,
              short: true,
            },
            {
              title: 'Usage',
              value: `${alert.percentage_used.toFixed(1)}%`,
              short: true,
            },
            {
              title: 'Remaining',
              value: `$${alert.remaining_budget.toFixed(2)}`,
              short: true,
            },
            {
              title: 'Period',
              value: alert.budget_period.charAt(0).toUpperCase() + alert.budget_period.slice(1),
              short: true,
            },
          ],
          footer: 'DuckCode Observability',
          footer_icon: 'https://duckcode.io/favicon.ico',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await axios.post(webhookUrl, slackMessage, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
  }

  /**
   * Send email notification (using SendGrid or AWS SES)
   */
  private async sendEmailAlert(alert: Alert, emails: string[]): Promise<void> {
    // Option 1: Using SendGrid (if SENDGRID_API_KEY is set)
    if (process.env.SENDGRID_API_KEY) {
      await this.sendViaSendGrid(alert, emails);
      return;
    }

    // Option 2: Using AWS SES (if AWS credentials are set)
    if (process.env.AWS_SES_REGION) {
      await this.sendViaSES(alert, emails);
      return;
    }

    // Option 3: Using SMTP (if SMTP settings are configured)
    if (process.env.SMTP_HOST) {
      await this.sendViaSMTP(alert, emails);
      return;
    }

    // No email provider configured
    console.warn('[AlertNotification] No email provider configured. Set SENDGRID_API_KEY, AWS SES, or SMTP settings.');
    throw new Error('No email provider configured');
  }

  /**
   * Send email via SendGrid
   */
  private async sendViaSendGrid(alert: Alert, emails: string[]): Promise<void> {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const severity = this.getAlertSeverity(alert.alert_type);
    const emoji = this.getAlertEmoji(alert.alert_type);

    const msg = {
      to: emails,
      from: process.env.SENDGRID_FROM_EMAIL || 'alerts@duckcode.io',
      subject: `${emoji} Budget Alert: ${alert.budget_name} (${severity})`,
      text: this.getEmailTextContent(alert),
      html: this.getEmailHtmlContent(alert),
    };

    await sgMail.send(msg);
  }

  /**
   * Send email via AWS SES
   */
  private async sendViaSES(alert: Alert, emails: string[]): Promise<void> {
    const AWS = require('aws-sdk');
    const ses = new AWS.SES({ region: process.env.AWS_SES_REGION || 'us-east-1' });

    const severity = this.getAlertSeverity(alert.alert_type);
    const emoji = this.getAlertEmoji(alert.alert_type);

    const params = {
      Source: process.env.AWS_SES_FROM_EMAIL || 'alerts@duckcode.io',
      Destination: {
        ToAddresses: emails,
      },
      Message: {
        Subject: {
          Data: `${emoji} Budget Alert: ${alert.budget_name} (${severity})`,
        },
        Body: {
          Text: {
            Data: this.getEmailTextContent(alert),
          },
          Html: {
            Data: this.getEmailHtmlContent(alert),
          },
        },
      },
    };

    await ses.sendEmail(params).promise();
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(alert: Alert, emails: string[]): Promise<void> {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const severity = this.getAlertSeverity(alert.alert_type);
    const emoji = this.getAlertEmoji(alert.alert_type);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@duckcode.io',
      to: emails.join(', '),
      subject: `${emoji} Budget Alert: ${alert.budget_name} (${severity})`,
      text: this.getEmailTextContent(alert),
      html: this.getEmailHtmlContent(alert),
    });
  }

  /**
   * Get email text content
   */
  private getEmailTextContent(alert: Alert): string {
    const severity = this.getAlertSeverity(alert.alert_type);

    return `
Budget Alert: ${alert.budget_name}

Severity: ${severity}
Threshold: ${alert.threshold_percentage}%

Current Details:
- Spent: $${alert.current_spend.toFixed(2)} of $${alert.budget_amount.toFixed(2)}
- Usage: ${alert.percentage_used.toFixed(1)}%
- Remaining: $${alert.remaining_budget.toFixed(2)}
- Period: ${alert.budget_period}

${alert.alert_type === 'exceeded' ? '⚠️ Budget has been exceeded!' : '📊 Approaching budget limit'}

View details in DuckCode Observability Dashboard.
    `.trim();
  }

  /**
   * Get email HTML content
   */
  private getEmailHtmlContent(alert: Alert): string {
    const severity = this.getAlertSeverity(alert.alert_type);
    const color = this.getAlertColor(alert.alert_type);
    const emoji = this.getAlertEmoji(alert.alert_type);

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .metric { display: inline-block; width: 48%; padding: 10px; margin: 5px 0; background: white; border-radius: 4px; }
    .metric-label { font-size: 12px; color: #666; }
    .metric-value { font-size: 24px; font-weight: bold; color: #333; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${emoji} Budget Alert: ${alert.budget_name}</h2>
      <p><strong>${severity}</strong> - ${alert.threshold_percentage}% threshold reached</p>
    </div>
    <div class="content">
      <div class="metric">
        <div class="metric-label">Current Spend</div>
        <div class="metric-value">$${alert.current_spend.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Budget Amount</div>
        <div class="metric-value">$${alert.budget_amount.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Usage</div>
        <div class="metric-value">${alert.percentage_used.toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Remaining</div>
        <div class="metric-value">$${alert.remaining_budget.toFixed(2)}</div>
      </div>
      <p style="margin-top: 20px;">
        <strong>Period:</strong> ${alert.budget_period.charAt(0).toUpperCase() + alert.budget_period.slice(1)}<br>
        ${alert.alert_type === 'exceeded' ? '<strong style="color: #d32f2f;">⚠️ Budget has been exceeded!</strong>' : '<strong>📊 Approaching budget limit</strong>'}
      </p>
    </div>
    <div class="footer">
      <p>DuckCode Observability - Budget Tracking System</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Helper: Get alert emoji
   */
  private getAlertEmoji(alertType: string): string {
    switch (alertType) {
      case 'threshold_1': return '📊';
      case 'threshold_2': return '⚠️';
      case 'threshold_3': return '🔴';
      case 'exceeded': return '🚨';
      default: return '📊';
    }
  }

  /**
   * Helper: Get alert severity label
   */
  private getAlertSeverity(alertType: string): string {
    switch (alertType) {
      case 'threshold_1': return 'Warning';
      case 'threshold_2': return 'High';
      case 'threshold_3': return 'Critical';
      case 'exceeded': return 'EXCEEDED';
      default: return 'Info';
    }
  }

  /**
   * Helper: Get alert color
   */
  private getAlertColor(alertType: string): string {
    switch (alertType) {
      case 'threshold_1': return '#ff9800'; // Orange
      case 'threshold_2': return '#f44336'; // Red
      case 'threshold_3': return '#d32f2f'; // Dark Red
      case 'exceeded': return '#b71c1c'; // Very Dark Red
      default: return '#2196f3'; // Blue
    }
  }

  /**
   * Record notification in database
   */
  private async recordNotification(alertId: string, emailSent: boolean, slackSent: boolean): Promise<void> {
    await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_alerts')
      .update({
        email_sent: emailSent,
        slack_sent: slackSent,
        notified_at: new Date().toISOString(),
      })
      .eq('id', alertId);
  }

  /**
   * Process pending alerts (called by cron job)
   */
  async processPendingAlerts(): Promise<NotificationResult[]> {
    console.log('[AlertNotification] Processing pending alerts...');

    // Get all unnotified alerts
    const { data: alerts, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_alerts')
      .select(`
        *,
        budget:snowflake_budgets(
          budget_name,
          budget_period,
          email_alerts,
          slack_webhook_url
        )
      `)
      .is('notified_at', null)
      .order('alerted_at', { ascending: true });

    if (error || !alerts || alerts.length === 0) {
      console.log('[AlertNotification] No pending alerts');
      return [];
    }

    console.log(`[AlertNotification] Found ${alerts.length} pending alerts`);

    const results: NotificationResult[] = [];

    for (const alert of alerts) {
      try {
        const budget = alert.budget;
        
        if (!budget.email_alerts && !budget.slack_webhook_url) {
          console.log(`[AlertNotification] Skipping alert ${alert.id} - no notification channels enabled`);
          continue;
        }

        // Get notification recipients
        const recipients = await this.getNotificationRecipients(alert.budget_id);

        const result = await this.sendAlert(
          {
            ...alert,
            budget_name: budget.budget_name,
            budget_period: budget.budget_period,
          },
          {
            emails: budget.email_alerts ? recipients.emails : undefined,
            slack_webhook: budget.slack_webhook_url || undefined,
          }
        );

        results.push(result);
      } catch (err) {
        console.error(`[AlertNotification] Failed to process alert ${alert.id}:`, err);
        results.push({
          alert_id: alert.id,
          email_sent: false,
          slack_sent: false,
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }

    return results;
  }

  /**
   * Get notification recipients for a budget
   */
  private async getNotificationRecipients(budgetId: string): Promise<{ emails: string[] }> {
    // Get budget creator and organization admins
    const { data: budget } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budgets')
      .select('created_by, organization_id')
      .eq('id', budgetId)
      .single();

    if (!budget) {
      return { emails: [] };
    }

    // Get organization admin emails
    const { data: admins } = await this.supabase
      .schema('enterprise')
      .from('user_organization_roles')
      .select('user_id, users:user_id(email)')
      .eq('organization_id', budget.organization_id)
      .in('role', ['admin', 'owner']);

    const emails: string[] = [];
    
    if (admins) {
      for (const admin of admins) {
        if (admin.users && admin.users.email) {
          emails.push(admin.users.email);
        }
      }
    }

    return { emails: [...new Set(emails)] }; // Remove duplicates
  }
}

export default new AlertNotificationService();
