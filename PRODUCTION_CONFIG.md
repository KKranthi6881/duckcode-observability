# Production Configuration Guide

## Environment Variables Required

### Core Services
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# JWT
JWT_SECRET=your-jwt-secret

# Server
PORT=3001
NODE_ENV=production
TZ=America/Chicago
```

### Email Notifications (Choose One)

#### Option 1: SendGrid (Recommended)
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=alerts@yourdomain.com
```

#### Option 2: AWS SES
```env
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=alerts@yourdomain.com
```

#### Option 3: SMTP
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=alerts@yourdomain.com
```

### Slack Notifications
Slack webhooks are configured per-budget in the database. No global configuration needed.

To create a Slack webhook:
1. Go to https://api.slack.com/apps
2. Create new app → Incoming Webhooks
3. Add webhook to workspace
4. Copy webhook URL
5. Add to budget settings in UI

---

## Package Installation

Install required npm packages:

```bash
cd backend

# Install production dependencies
npm install node-cron --save
npm install @sendgrid/mail --save  # If using SendGrid
npm install aws-sdk --save          # If using AWS SES
npm install nodemailer --save       # If using SMTP
npm install axios --save            # For Slack webhooks

# Install types
npm install --save-dev @types/node-cron
npm install --save-dev @types/nodemailer
```

---

## Scheduled Jobs Configuration

### Job Schedules

| Job | Schedule | Description |
|-----|----------|-------------|
| `snowflake-sync` | Daily at 2 AM | Sync cost data from Snowflake |
| `budget-alert-check` | Every hour | Check budgets against thresholds |
| `notification-processing` | Every 5 minutes | Send pending email/Slack alerts |
| `budget-snapshots` | Daily at midnight | Create daily budget snapshots |

### Customize Job Schedules

Edit `/backend/src/jobs/scheduler.ts`:

```typescript
// Cron schedule format: 'minute hour day month dayofweek'

// Examples:
'0 2 * * *'      // Daily at 2 AM
'0 * * * *'      // Every hour
'*/5 * * * *'    // Every 5 minutes
'0 0 * * *'      // Daily at midnight
'0 0 * * 0'      // Weekly on Sunday at midnight
'0 0 1 * *'      // Monthly on 1st at midnight
```

---

## Start the Scheduler

### Development
```bash
cd backend
npm run dev
```

The scheduler starts automatically with the server.

### Production

#### Option 1: PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/server.js --name duckcode-backend

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup
```

#### Option 2: Docker
```bash
# Build
docker build -t duckcode-backend .

# Run
docker run -d \
  -p 3001:3001 \
  --env-file .env \
  --name duckcode-backend \
  duckcode-backend
```

#### Option 3: Systemd Service
```bash
# Create service file: /etc/systemd/system/duckcode-backend.service
[Unit]
Description=DuckCode Backend
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/var/www/duckcode-backend
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable duckcode-backend
sudo systemctl start duckcode-backend
```

---

## Monitoring

### Check Job Status

**API Endpoint:**
```bash
GET /api/jobs/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "jobs": [
    {
      "name": "snowflake-sync",
      "running": true,
      "schedule": "Daily at 2 AM"
    },
    {
      "name": "budget-alert-check",
      "running": true,
      "schedule": "Every hour"
    },
    {
      "name": "notification-processing",
      "running": true,
      "schedule": "Every 5 minutes"
    },
    {
      "name": "budget-snapshots",
      "running": true,
      "schedule": "Daily at midnight"
    }
  ]
}
```

### Manual Job Trigger

**API Endpoint:**
```bash
POST /api/jobs/run/:jobName
Authorization: Bearer <token>
```

**Example:**
```bash
# Trigger Snowflake sync manually
curl -X POST http://localhost:3001/api/jobs/run/snowflake-sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Log Files

Backend logs will show job execution:
```
[Scheduler] Starting job scheduler...
[Scheduler] ✓ Scheduled: snowflake-sync (Daily at 2 AM)
[Scheduler] ✓ Scheduled: budget-alert-check (Every hour)
[Scheduler] ✓ Scheduled: notification-processing (Every 5 minutes)
[Scheduler] ✓ Scheduled: budget-snapshots (Daily at midnight)
[Scheduler] ✓ Started 4 scheduled jobs
```

---

## Testing

### Test Email Notifications
```bash
# Add test alert to database
INSERT INTO enterprise.snowflake_budget_alerts (
  budget_id,
  alert_type,
  threshold_percentage,
  current_spend,
  budget_amount,
  percentage_used,
  email_sent,
  slack_sent
) VALUES (
  'YOUR_BUDGET_ID',
  'threshold_1',
  75,
  750,
  1000,
  75,
  false,
  false
);

# Trigger notification processing
curl -X POST http://localhost:3001/api/jobs/run/notification-processing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Slack Notifications
```bash
# Test webhook directly
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Test message from DuckCode"
  }'
```

### Test Snowflake Sync
```bash
# Trigger sync manually
curl -X POST http://localhost:3001/api/jobs/run/snowflake-sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### Jobs Not Running
1. Check server logs for errors
2. Verify timezone setting (TZ env var)
3. Ensure server is running continuously

### Email Not Sending
1. Verify email provider credentials
2. Check SENDGRID_API_KEY / AWS credentials / SMTP settings
3. Check email provider quotas/limits
4. Review logs for specific errors

### Slack Not Sending
1. Verify webhook URL is correct
2. Test webhook directly with curl
3. Check webhook hasn't been revoked
4. Ensure Slack app has correct permissions

### Snowflake Sync Failing
1. Verify Snowflake credentials
2. Check Snowflake ACCOUNT_USAGE permissions
3. Verify network connectivity to Snowflake
4. Review query syntax in SnowflakeDataSyncService.ts

---

## Production Checklist

- [ ] Install node-cron and dependencies
- [ ] Configure email provider (SendGrid/SES/SMTP)
- [ ] Set up environment variables
- [ ] Test email notifications
- [ ] Configure Slack webhooks
- [ ] Test Slack notifications
- [ ] Verify Snowflake credentials
- [ ] Test Snowflake sync
- [ ] Set up process manager (PM2)
- [ ] Configure monitoring/logging
- [ ] Set up alerts for job failures
- [ ] Document backup/recovery procedures

---

## Support

For issues or questions:
1. Check logs: `pm2 logs duckcode-backend`
2. Review job status: `GET /api/jobs/status`
3. Manually trigger jobs to test: `POST /api/jobs/run/:jobName`
4. Check Supabase database for alert records
