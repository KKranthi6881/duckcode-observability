#!/bin/bash

# Use environment variables instead of hardcoded secrets
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# These should be set in your environment or .env file
# export OPENAI_API_KEY=your_openai_api_key_here
# export GITHUB_APP_ID=your_github_app_id_here
# export GITHUB_APP_PRIVATE_KEY="your_github_private_key_here"

echo "Starting Supabase edge function with environment variables..."
echo "Note: Make sure OPENAI_API_KEY, GITHUB_APP_ID, and GITHUB_APP_PRIVATE_KEY are set in your environment"

npx supabase functions serve code-processor --no-verify-jwt --env-file ./supabase/functions/.env.local 