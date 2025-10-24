# Testing the Complete Auto-Documentation System

## Quick Test Script

Run the automated test:

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
node test-auto-system.js
```

## Manual Testing Steps

### 1. Connect GitHub Repository (Via UI or API)

The system automatically creates a webhook when you connect a repo.

Check logs for:
```
✅ [Webhook] Successfully created webhook ID: 123456789
```

### 2. Push Code to Repository

```bash
git commit --allow-empty -m "Test auto-extraction"
git push origin main
```

### 3. Check Backend Logs

You should see:
```
📨 Received GitHub webhook: push
✅ Triggering automatic extraction
📄 [Auto-Update] Checking for documentation updates
[ChangeDetector] Changes detected
```

### 4. Verify Database

```sql
-- Check webhook events
SELECT * FROM metadata.webhook_events 
ORDER BY created_at DESC LIMIT 5;

-- Check update events
SELECT * FROM metadata.documentation_update_events 
ORDER BY created_at DESC LIMIT 5;

-- Check objects were extracted
SELECT COUNT(*) FROM metadata.objects;
```

## Expected Results

✅ Webhook automatically created
✅ Metadata extracted on push
✅ Changes detected
✅ Documentation jobs created (if enabled)
✅ All events logged

## Troubleshooting

**Webhook not created:**
- Check GitHub token has `admin:repo_hook` permission
- Check backend logs for errors

**Extraction not triggered:**
- Verify webhook signature validation passed
- Check connection is active

**Documentation not updated:**
- Check if auto-update is enabled in organization settings
- Verify changes were detected
