import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}

export interface InvitationEmailData {
  inviteeName?: string;
  inviterName: string;
  organizationName: string;
  roleName: string;
  acceptUrl: string;
  expiresAt: string;
}

class EmailService {
  private fromEmail: string;
  private replyToEmail: string;
  private frontendUrl: string;
  private isEnabled: boolean;
  private resend: Resend | null;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@duckcode.ai';
    this.replyToEmail = process.env.EMAIL_REPLY_TO || 'support@duckcode.ai';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    this.isEnabled = !!process.env.RESEND_API_KEY;
    this.resend = null;

    if (this.isEnabled) {
      try {
        this.resend = new Resend(process.env.RESEND_API_KEY!);
      } catch (e) {
        // If construction fails for any reason, disable email sending and log
        this.isEnabled = false;
        this.resend = null;
        console.warn('⚠️  Failed to initialize Resend client. Emails will be logged to console only.', e);
      }
    } else {
      console.warn('⚠️  RESEND_API_KEY not configured. Emails will be logged to console only.');
    }
  }

  /**
   * Send generic email
   */
  async sendEmail(options: SendEmailOptions): Promise<{success: boolean; messageId?: string; error?: string}> {
    try {
      if (!this.isEnabled) {
        console.log('📧 Email (dev mode):', {
          to: options.to,
          subject: options.subject,
          html: options.html.substring(0, 200) + '...',
        });
        return { success: true, messageId: 'dev-mode-' + Date.now() };
      }

      const { data, error } = await this.resend!.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo || this.replyToEmail,
      });

      if (error) {
        console.error('Failed to send email:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Email sent successfully:', data?.id);
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Email service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(email: string, data: InvitationEmailData): Promise<{success: boolean; messageId?: string; error?: string}> {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `You're invited to join ${data.organizationName} on DuckCode`;
    const html = this.getInvitationTemplate(data, expiryDate);

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Send invitation reminder email (2 days before expiry)
   */
  async sendInvitationReminderEmail(email: string, data: InvitationEmailData): Promise<{success: boolean; messageId?: string; error?: string}> {
    const subject = `Reminder: Your invitation to ${data.organizationName} expires soon`;
    const html = this.getReminderTemplate(data);

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Send welcome email after accepting invitation
   */
  async sendWelcomeEmail(email: string, organizationName: string, roleName: string): Promise<{success: boolean; messageId?: string; error?: string}> {
    const subject = `Welcome to ${organizationName}!`;
    const html = this.getWelcomeTemplate(organizationName, roleName);

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Send role change notification
   */
  async sendRoleChangeEmail(email: string, organizationName: string, oldRole: string, newRole: string): Promise<{success: boolean; messageId?: string; error?: string}> {
    const subject = `Your role in ${organizationName} has been updated`;
    const html = this.getRoleChangeTemplate(organizationName, oldRole, newRole);

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Send removal notification
   */
  async sendRemovalEmail(email: string, organizationName: string): Promise<{success: boolean; messageId?: string; error?: string}> {
    const subject = `You have been removed from ${organizationName}`;
    const html = this.getRemovalTemplate(organizationName);

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  // ==================== Email Templates ====================

  private getInvitationTemplate(data: InvitationEmailData, expiryDate: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to ${data.organizationName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${data.inviteeName ? `Hi ${data.inviteeName},` : 'Hi there,'}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on DuckCode as a <strong>${data.roleName}</strong>.
    </p>
    
    <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        <strong>Role:</strong> ${data.roleName}<br>
        <strong>Organization:</strong> ${data.organizationName}<br>
        <strong>Expires:</strong> ${expiryDate}
      </p>
    </div>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${data.acceptUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      This invitation will expire on ${expiryDate}. If you don't accept it by then, you'll need to request a new invitation.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #9ca3af;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} DuckCode. All rights reserved.</p>
  </div>
</body>
</html>
    `;
  }

  private getReminderTemplate(data: InvitationEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reminder: Invitation Expiring Soon</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fbbf24; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: #78350f; margin: 0; font-size: 28px;">⏰ Invitation Expiring Soon</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px;">Hi there,</p>
    
    <p style="font-size: 16px;">
      This is a friendly reminder that your invitation to join <strong>${data.organizationName}</strong> will expire in 2 days.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.acceptUrl}" style="background: #fbbf24; color: #78350f; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
        Accept Invitation Now
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">
      Don't miss out on joining ${data.organizationName}!
    </p>
  </div>
</body>
</html>
    `;
  }

  private getWelcomeTemplate(organizationName: string, roleName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to ${organizationName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to ${organizationName}!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px;">Congratulations!</p>
    
    <p style="font-size: 16px;">
      You've successfully joined <strong>${organizationName}</strong> as a <strong>${roleName}</strong>.
    </p>
    
    <p style="font-size: 16px;">
      You can now access your organization's dashboard, collaborate with your team, and start using all the features available to you.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${this.frontendUrl}/admin" style="background: #10b981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
        Go to Dashboard
      </a>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getRoleChangeTemplate(organizationName: string, oldRole: string, newRole: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Role Updated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #3b82f6; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Role Updated</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px;">Hi there,</p>
    
    <p style="font-size: 16px;">
      Your role in <strong>${organizationName}</strong> has been updated from <strong>${oldRole}</strong> to <strong>${newRole}</strong>.
    </p>
    
    <p style="font-size: 16px;">
      ${this.getRoleDescription(newRole)}
    </p>
  </div>
</body>
</html>
    `;
  }

  private getRemovalTemplate(organizationName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Removed from Organization</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #ef4444; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Organization Access Removed</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px;">Hi there,</p>
    
    <p style="font-size: 16px;">
      You have been removed from <strong>${organizationName}</strong>.
    </p>
    
    <p style="font-size: 16px;">
      You will no longer have access to the organization's data or resources.
    </p>
    
    <p style="font-size: 14px; color: #6b7280;">
      If you believe this was done in error, please contact the organization administrator.
    </p>
  </div>
</body>
</html>
    `;
  }

  private getRoleDescription(role: string): string {
    const descriptions: Record<string, string> = {
      'Admin': 'You now have full administrative access to the organization, including the ability to manage members, teams, and settings.',
      'Member': 'You can now work with data, collaborate with your team, and access most features of the organization.',
      'Viewer': 'You have read-only access to view data and analytics within the organization.',
    };
    return descriptions[role] || 'Your new role may have different permissions than your previous role.';
  }
}

export default new EmailService();
