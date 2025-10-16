-- =====================================================
-- Add Email Tracking to Invitations
-- =====================================================
-- Track email sending status and metadata for invitations
-- =====================================================

-- Create email status enum
CREATE TYPE enterprise.email_status AS ENUM ('pending', 'sent', 'failed', 'bounced');

-- Add email tracking columns to invitations
ALTER TABLE enterprise.organization_invitations
ADD COLUMN IF NOT EXISTS email_status enterprise.email_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_message_id TEXT,
ADD COLUMN IF NOT EXISTS email_error TEXT,
ADD COLUMN IF NOT EXISTS email_attempts INTEGER DEFAULT 0;

-- Create index for email status queries
CREATE INDEX IF NOT EXISTS idx_invitations_email_status 
ON enterprise.organization_invitations(email_status);

-- Create index for pending emails (for retry jobs)
CREATE INDEX IF NOT EXISTS idx_invitations_pending_emails 
ON enterprise.organization_invitations(email_status, created_at) 
WHERE email_status = 'pending';

COMMENT ON COLUMN enterprise.organization_invitations.email_status IS 'Status of invitation email (pending, sent, failed, bounced)';
COMMENT ON COLUMN enterprise.organization_invitations.email_sent_at IS 'Timestamp when email was successfully sent';
COMMENT ON COLUMN enterprise.organization_invitations.email_message_id IS 'Email service message ID for tracking';
COMMENT ON COLUMN enterprise.organization_invitations.email_error IS 'Error message if email failed to send';
COMMENT ON COLUMN enterprise.organization_invitations.email_attempts IS 'Number of times email sending was attempted';
