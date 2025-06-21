-- supabase/migrations/20250620220000_schedule_code_processor_cron.sql

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- This schedules the code-processor function to be called every minute.
-- It uses net.http_post to make a request from within the Supabase infrastructure.
SELECT cron.schedule(
    'invoke-code-processor-every-minute',
    '*/1 * * * *', -- This is the cron expression for "every minute"
    $$
    SELECT net.http_post(
        url:='http://kong:8000/functions/v1/code-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"}'::jsonb,
        body:='{}'::jsonb
    );
    $$
);