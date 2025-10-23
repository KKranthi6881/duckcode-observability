# How to Capture Extraction Logs

## Problem
Extraction logs disappear from console because the process is long and console buffer is limited.

## Solution Options

### Option 1: Redirect Backend Output to File (Immediate)

**Start backend with logging:**
```bash
cd backend
npm run dev 2>&1 | tee logs/extraction-$(date +%Y%m%d-%H%M%S).log
```

This will:
- Show logs in console (normal)
- ALSO save all logs to a file in `logs/` directory
- Keep logs even after extraction completes

### Option 2: Use PM2 for Log Management (Production)

**Install PM2:**
```bash
npm install -g pm2
```

**Start backend with PM2:**
```bash
cd backend
pm2 start npm --name "duckcode-backend" -- run dev
```

**View logs:**
```bash
pm2 logs duckcode-backend
pm2 logs duckcode-backend --lines 1000  # Last 1000 lines
```

**Save logs to file:**
```bash
pm2 logs duckcode-backend --raw > extraction-logs.txt
```

**Log files location:**
```
~/.pm2/logs/duckcode-backend-out.log
~/.pm2/logs/duckcode-backend-error.log
```

### Option 3: Docker Logs (If using Docker)

```bash
docker logs -f <container-name> > extraction-logs.txt
```

### Option 4: Add File Logging to Code (Best for Enterprise)

We created `ExtractionLogger.ts` which writes to both console AND file.

**Log files will be saved to:**
```
backend/logs/extractions/extraction-{connectionId}-{timestamp}.log
```

## Quick Start (Recommended)

**1. Create logs directory:**
```bash
mkdir -p backend/logs
```

**2. Start backend with file logging:**
```bash
cd backend
npm run dev 2>&1 | tee logs/extraction-$(date +%Y%m%d-%H%M%S).log
```

**3. Trigger extraction in UI**

**4. Check logs:**
```bash
# View latest log file
ls -lt backend/logs/extraction-*.log | head -1

# Search for specific sections
grep "🔗 Storing" backend/logs/extraction-*.log
grep "Missing source objects" backend/logs/extraction-*.log
grep "Dependency storage complete" backend/logs/extraction-*.log
```

## What to Look For in Logs

### 1. Manifest Parsing
```
📊 Parsed manifest:
   Models: XXXX
   Sources: XXXX
   Dependencies: XXXX  ← Should be 2000-3000 for gitlab-data/analytics
   Column Lineage: XXXX
```

### 2. Object Map Building
```
📋 Object map built:
   Total objects in DB: XXXX
   Objects with unique_id: XXXX  ← Should match total objects
   Sample unique_ids (first 5):
      - model.gitlab_data_analytics.fct_charge
      - source.gitlab_data_analytics.gitlab_dotcom.issues
      ...
```

### 3. Dependency Storage
```
🔗 Storing XXXX dependencies from manifest...
✅ Dependency storage complete:
   ✓ Stored: XXXX  ← Should be 60-80% of total dependencies
   ⚠️  Skipped (source not found): XXXX
   ⚠️  Skipped (target not found): XXXX

   Missing source objects (first 10):
      - source.gitlab_data_analytics.gitlab_dotcom.issues
      ...
```

### 4. Column Lineage
```
📊 Processing: fct_charge
   Dependencies: prep_charge, prep_amendment
   Extracted X column lineages
```

## Analyzing the Logs

### Check Dependency Coverage
```bash
# Count stored dependencies
grep "✓ Stored:" backend/logs/extraction-*.log

# Count skipped dependencies
grep "⚠️  Skipped" backend/logs/extraction-*.log

# Find missing unique_ids
grep -A 20 "Missing source objects" backend/logs/extraction-*.log
```

### Check for Errors
```bash
# Find all errors
grep -i "error" backend/logs/extraction-*.log

# Find warnings
grep "⚠️" backend/logs/extraction-*.log
```

### Extract Statistics
```bash
# Get all statistics
grep "📊" backend/logs/extraction-*.log
grep "✅" backend/logs/extraction-*.log
```

## Example Analysis Session

```bash
# 1. Start backend with logging
cd backend
npm run dev 2>&1 | tee logs/extraction-$(date +%Y%m%d-%H%M%S).log

# 2. In another terminal, monitor logs in real-time
tail -f backend/logs/extraction-*.log | grep -E "🔗|✅|⚠️|📊"

# 3. After extraction completes, analyze
LOG_FILE=$(ls -t backend/logs/extraction-*.log | head -1)

echo "=== Manifest Stats ==="
grep "📊 Parsed manifest" -A 4 $LOG_FILE

echo "=== Object Map ==="
grep "📋 Object map built" -A 6 $LOG_FILE

echo "=== Dependency Storage ==="
grep "🔗 Storing" -A 10 $LOG_FILE

echo "=== Missing Objects ==="
grep "Missing source objects" -A 15 $LOG_FILE
```

## Troubleshooting

### Logs not appearing
- Check if `logs/` directory exists
- Ensure write permissions: `chmod 755 backend/logs`
- Try absolute path: `tee /full/path/to/logs/extraction.log`

### Logs too large
```bash
# Compress old logs
gzip backend/logs/extraction-*.log

# Keep only last 10 log files
ls -t backend/logs/extraction-*.log | tail -n +11 | xargs rm
```

### Need specific section
```bash
# Extract just dependency storage section
sed -n '/🔗 Storing/,/✅ Dependency storage complete/p' $LOG_FILE
```

## Next Steps

1. **Start backend with logging** (Option 1 above)
2. **Trigger extraction** in UI
3. **Analyze logs** to find why dependencies are skipped
4. **Share relevant sections** for debugging
5. **Fix based on findings**

## Enterprise Setup (Future)

For production, implement:
1. ✅ Structured logging (Winston/Pino)
2. ✅ Log rotation (daily/size-based)
3. ✅ Log aggregation (ELK/Datadog)
4. ✅ Real-time monitoring dashboard
5. ✅ Alerting on extraction failures
6. ✅ Log retention policy (30 days)
