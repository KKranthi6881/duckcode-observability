# Environment Variables

This backend application requires the following environment variables to be set:

## Required Variables

### GitHub Integration
- `GITHUB_APP_ID` - Your GitHub App ID
- `GITHUB_PRIVATE_KEY` - Your GitHub App private key (with escaped newlines)
- `GITHUB_APP_NAME` - Your GitHub App name

### Database
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### AI Services
- `OPENAI_API_KEY` - Your OpenAI API key for generating code summaries

### Application
- `FRONTEND_URL` - URL of your frontend application (for CORS and redirects)
- `PORT` - Port number for the backend server (optional, defaults to 3000)
- `JWT_SECRET` - Secret used to sign and verify short-lived OAuth tokens between IDE and SaaS
- `ADMIN_EMAILS` - Comma-separated list of admin emails allowed to approve waitlist users (e.g. `founder@company.com,admin@company.com`)

## Setup Instructions

1. Copy this file to `.env` in the backend directory
2. Fill in all the required values
3. Make sure `.env` is in your `.gitignore` file (it should be by default)

## Waitlist Mode (Early Access)

During early access, registration is handled via a waitlist:

- Public endpoint to join waitlist: `POST /api/waitlist/join`
  - Body: `{ email, full_name?, plan_choice: 'own_api_key'|'free_50_pro', agent_interests: string[], source?: 'web'|'ide' }`
- Admin endpoints (require valid bearer token and email in `ADMIN_EMAILS`):
  - List: `GET /api/waitlist?status=pending|approved|rejected`
  - Approve: `PUT /api/waitlist/:id/approve` (sends Supabase invite or magic link)
  - Reject: `PUT /api/waitlist/:id/reject`

Database objects are created by the migration in `supabase/migrations/*waitlist*.sql` and use the `duckcode` schema. Ensure migrations are applied.

## AI Summary Generation

The application uses OpenAI's GPT-4o-mini model to generate intelligent code summaries. To enable this feature:

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Set the `OPENAI_API_KEY` environment variable
3. Use the `/api/insights/generate-summaries/:owner/:repo` endpoint to generate summaries for repository files

Without the OpenAI API key, the summary generation endpoint will return a 500 error with an appropriate message.
