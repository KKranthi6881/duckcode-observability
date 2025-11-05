-- Add alert_emails column to allow custom email addresses for budget alerts
-- This allows users to specify who should receive alerts instead of auto-sending to all admins

ALTER TABLE enterprise.snowflake_budgets 
ADD COLUMN IF NOT EXISTS alert_emails TEXT[];

COMMENT ON COLUMN enterprise.snowflake_budgets.alert_emails IS 
'Array of email addresses to receive budget alerts. If null or empty, alerts go to organization admins.';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_budgets_alert_emails 
ON enterprise.snowflake_budgets USING GIN (alert_emails);

-- Update the notification service to use custom emails if provided
-- Otherwise fall back to organization admins
