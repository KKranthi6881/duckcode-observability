-- Add provider column to github_connections table to support GitLab
-- Migration: 20251022000001_add_provider_to_github_connections.sql

-- Add provider column with default 'github' for existing records
ALTER TABLE enterprise.github_connections 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'github' NOT NULL;

-- Add check constraint to ensure only valid providers
ALTER TABLE enterprise.github_connections
ADD CONSTRAINT github_connections_provider_check 
CHECK (provider IN ('github', 'gitlab'));

-- Add comment to document the column
COMMENT ON COLUMN enterprise.github_connections.provider IS 'Git provider: github or gitlab';

-- Update existing records to have 'github' as provider (in case column existed without default)
UPDATE enterprise.github_connections 
SET provider = 'github' 
WHERE provider IS NULL;
