# 🧪 DuckCode UAT/Staging Deployment Guide

**Complete Guide for UAT Environment Setup**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [UAT Environment Setup](#uat-environment-setup)
3. [Subdomain Configuration](#subdomain-configuration)
4. [Database Setup](#database-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Testing Procedures](#testing-procedures)
8. [Data Management](#data-management)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What is UAT?

**UAT (User Acceptance Testing)** is a pre-production environment where you:
- Test new features before production
- Validate bug fixes
- Perform integration testing
- Train team members
- Demo to stakeholders

### UAT vs Production

| Aspect | UAT | Production |
|--------|-----|------------|
| **URL** | uat.duckcode.dev | app.duckcode.dev |
| **API** | api-uat.duckcode.dev | api.duckcode.dev |
| **Database** | Supabase UAT project | Supabase Production |
| **Users** | Test accounts | Real customers |
| **Data** | Test/dummy data | Real customer data |
| **Monitoring** | Basic | Comprehensive |
| **Uptime** | 95% | 99.9% |

### UAT Environment Goals

✅ **Test new features safely**  
✅ **Validate security implementations**  
✅ **Perform load testing**  
✅ **Train team members**  
✅ **Demo to stakeholders**  
✅ **Catch bugs before production**  

---

## UAT Environment Setup

### Step 1: Provision UAT Server

#### Option A: Shared Server with Production (Cost-Effective)

```bash
# Use same server, different ports
# Production: 3001
# UAT: 3002

# Pros: Lower cost, same infrastructure
# Cons: Resource sharing, potential conflicts
```

#### Option B: Separate Server (Recommended)

```bash
# Create new DigitalOcean Droplet
- OS: Ubuntu 22.04 LTS
- Plan: Basic ($12/mo - 2GB RAM, 1 vCPU, 50GB SSD)
- Datacenter: Same as production
- Hostname: uat-duckcode

# Connect
ssh root@uat-server-ip

# Create user
adduser duckcode-uat
usermod -aG sudo duckcode-uat
su - duckcode-uat
```

### Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Install Git
sudo apt-get install -y git

# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Verify installations
node --version
npm --version
pm2 --version
nginx -v
```

### Step 3: Configure Firewall

```bash
# Install UFW
sudo apt-get install -y ufw

# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Subdomain Configuration

### Step 1: Add DNS Records

**At your domain registrar (e.g., Namecheap, GoDaddy):**

```
Type    Name        Value               TTL
A       uat         uat-server-ip       3600
A       api-uat     uat-server-ip       3600
```

**Verify DNS propagation:**

```bash
# Check DNS resolution
dig uat.duckcode.dev
dig api-uat.duckcode.dev

# Or use online tool:
# https://dnschecker.org/
```

### Step 2: Configure Nginx for UAT Frontend

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/duckcode-uat-frontend
```

**Add configuration:**

```nginx
server {
    listen 80;
    server_name uat.duckcode.dev;
    
    root /var/www/duckcode-uat/frontend/dist;
    index index.html;

    # Add UAT banner identifier
    add_header X-Environment "UAT" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1h;
        add_header Cache-Control "public";
    }

    # No cache for index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/duckcode-uat-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Configure Nginx for UAT Backend

```bash
# Create backend config
sudo nano /etc/nginx/sites-available/duckcode-uat-backend
```

**Add configuration:**

```nginx
server {
    listen 80;
    server_name api-uat.duckcode.dev;

    # Rate limiting (more lenient for testing)
    limit_req_zone $binary_remote_addr zone=uat_api_limit:10m rate=200r/m;
    limit_req zone=uat_api_limit burst=50 nodelay;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Add UAT identifier
        add_header X-Environment "UAT" always;
    }

    # Health check
    location /api/health {
        proxy_pass http://localhost:3002;
        access_log off;
    }
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/duckcode-uat-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Install SSL Certificates

```bash
# Install SSL for UAT frontend
sudo certbot --nginx -d uat.duckcode.dev

# Install SSL for UAT backend
sudo certbot --nginx -d api-uat.duckcode.dev

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## Database Setup

### Step 1: Create Supabase UAT Project

```bash
# 1. Go to https://supabase.com/dashboard
# 2. Click "New Project"
# 3. Configure:
   - Name: duckcode-uat
   - Database Password: <generate-strong-password>
   - Region: Same as production
   - Plan: Free (for UAT) or Pro ($25/month)

# 4. Wait for project creation

# 5. Note credentials:
   - Project URL: https://xxxxx-uat.supabase.co
   - Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   - Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Apply Migrations to UAT Database

```bash
# On your local machine
cd /path/to/duckcode-observability

# Link to UAT project
supabase link --project-ref your-uat-project-ref

# Apply all migrations
supabase db push

# Verify tables created
supabase db diff
```

### Step 3: Seed Test Data (Optional)

```bash
# Create seed script
nano supabase/seed-uat.sql
```

**Add test data:**

```sql
-- Seed UAT database with test data

-- Test users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'test1@duckcode.dev', crypt('TestPass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'test2@duckcode.dev', crypt('TestPass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'admin@duckcode.dev', crypt('AdminPass123!', gen_salt('bf')), NOW(), NOW(), NOW());

-- Test user profiles
INSERT INTO duckcode.users (id, email, full_name, role, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'test1@duckcode.dev', 'Test User 1', 'user', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'test2@duckcode.dev', 'Test User 2', 'user', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'admin@duckcode.dev', 'Admin User', 'admin', NOW());

-- Test conversations (for analytics testing)
INSERT INTO duckcode.conversation_analytics (
  user_id, topic_title, model_name, provider, mode,
  input_tokens, output_tokens, total_tokens,
  charged_cost, actual_api_cost, profit_amount, profit_margin,
  message_count, status
)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Test Conversation 1', 'gpt-4', 'openai', 'chat', 
   1000, 500, 1500, 0.05, 0.025, 0.025, 50.0, 5, 'completed'),
  ('22222222-2222-2222-2222-222222222222', 'Test Conversation 2', 'claude-3-opus', 'anthropic', 'chat',
   2000, 1000, 3000, 0.10, 0.05, 0.05, 50.0, 8, 'completed');
```

**Apply seed data:**

```bash
psql $UAT_DATABASE_URL -f supabase/seed-uat.sql
```

---

## Backend Deployment

### Step 1: Clone Repository

```bash
# SSH into UAT server
ssh duckcode-uat@uat-server-ip

# Create directory
sudo mkdir -p /var/www/duckcode-uat
sudo chown -R duckcode-uat:duckcode-uat /var/www/duckcode-uat
cd /var/www/duckcode-uat

# Clone repository
git clone https://github.com/your-org/duckcode-observability.git
cd duckcode-observability/backend

# Checkout UAT branch (if you have one)
git checkout uat
# Or use main/develop branch
```

### Step 2: Configure UAT Environment

```bash
# Create UAT .env file
nano .env
```

**Add UAT configuration:**

```bash
# ============================================
# UAT Environment Configuration
# ============================================

# Environment
NODE_ENV=uat
PORT=3002

# ============================================
# JWT Configuration
# ============================================
# Generate unique UAT secret (different from production)
JWT_SECRET=<GENERATE_UNIQUE_UAT_SECRET>

# ============================================
# Supabase UAT Configuration
# ============================================
SUPABASE_URL=https://xxxxx-uat.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SCHEMA=duckcode

# ============================================
# Frontend URL
# ============================================
FRONTEND_URL=https://uat.duckcode.dev

# ============================================
# Security Configuration (More Lenient for Testing)
# ============================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_REGISTRATION_MAX=5
RATE_LIMIT_REGISTRATION_WINDOW_MS=3600000

LOCKOUT_ENABLED=true
LOCKOUT_MAX_ATTEMPTS=10
LOCKOUT_DURATION_MINUTES=15
LOCKOUT_TRACKING_WINDOW_MINUTES=15

PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=false

AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=30

SESSION_WEB_EXPIRY_DAYS=7
SESSION_IDE_EXPIRY_DAYS=3
SESSION_INVALIDATE_ON_PASSWORD_CHANGE=true
SESSION_MAX_CONCURRENT=10

# ============================================
# UAT-Specific Settings
# ============================================
# Enable debug logging
LOG_LEVEL=debug

# Disable email verification for easier testing
EMAIL_VERIFICATION_REQUIRED=false

# Enable test mode features
TEST_MODE=true
```

**Generate UAT JWT_SECRET:**

```bash
openssl rand -base64 32
# Add output to .env
```

### Step 3: Install & Build

```bash
# Install dependencies
npm ci

# Build TypeScript
npm run build

# Verify build
ls -la dist/
```

### Step 4: Start UAT Backend

```bash
# Create PM2 ecosystem for UAT
nano ecosystem.uat.config.js
```

**Add configuration:**

```javascript
module.exports = {
  apps: [{
    name: 'duckcode-uat-backend',
    script: './dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'uat',
      PORT: 3002
    },
    error_file: './logs/uat-err.log',
    out_file: './logs/uat-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10
  }]
};
```

**Start with PM2:**

```bash
# Create logs directory
mkdir -p logs

# Start UAT backend
pm2 start ecosystem.uat.config.js

# Save PM2 config
pm2 save

# Configure startup
pm2 startup

# Verify running
pm2 status
pm2 logs duckcode-uat-backend

# Test health endpoint
curl http://localhost:3002/api/health
```

---

## Frontend Deployment

### Step 1: Build UAT Frontend

```bash
# Navigate to frontend
cd /var/www/duckcode-uat/duckcode-observability/frontend

# Create UAT environment file
nano .env.uat
```

**Add UAT configuration:**

```bash
VITE_API_URL=https://api-uat.duckcode.dev
VITE_SUPABASE_URL=https://xxxxx-uat.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OAUTH_REDIRECT_URI=https://uat.duckcode.dev/auth/callback
VITE_ENVIRONMENT=uat
```

**Build for UAT:**

```bash
# Install dependencies
npm ci

# Build with UAT config
npm run build -- --mode uat

# Verify build
ls -la dist/
```

### Step 2: Add UAT Environment Banner

```bash
# Edit index.html to add UAT banner
nano dist/index.html
```

**Add banner (before closing </body>):**

```html
<!-- UAT Environment Banner -->
<div style="position: fixed; top: 0; left: 0; right: 0; background: #ff6b00; color: white; text-align: center; padding: 8px; font-weight: bold; z-index: 9999; font-family: sans-serif;">
  ⚠️ UAT ENVIRONMENT - Test Data Only
</div>
<style>
  body { padding-top: 40px !important; }
</style>
```

---

## Testing Procedures

### Step 1: Smoke Tests

```bash
# Create smoke test script
nano ~/uat-smoke-tests.sh
```

**Add tests:**

```bash
#!/bin/bash

echo "🧪 Running UAT Smoke Tests..."
echo ""

# Test 1: Frontend accessible
echo "Test 1: Frontend accessible"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://uat.duckcode.dev)
if [ "$STATUS" -eq 200 ]; then
  echo "✅ PASS: Frontend returns 200"
else
  echo "❌ FAIL: Frontend returns $STATUS"
fi
echo ""

# Test 2: Backend health check
echo "Test 2: Backend health check"
HEALTH=$(curl -s https://api-uat.duckcode.dev/api/health | jq -r '.status')
if [ "$HEALTH" = "ok" ]; then
  echo "✅ PASS: Backend health OK"
else
  echo "❌ FAIL: Backend health check failed"
fi
echo ""

# Test 3: Registration endpoint
echo "Test 3: Registration endpoint"
REGISTER=$(curl -s -X POST https://api-uat.duckcode.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-$(date +%s)@test.com\",\"password\":\"TestPass123!\",\"fullName\":\"Test User\"}" \
  | jq -r '.token')
if [ ! -z "$REGISTER" ] && [ "$REGISTER" != "null" ]; then
  echo "✅ PASS: Registration works"
else
  echo "❌ FAIL: Registration failed"
fi
echo ""

# Test 4: Login endpoint
echo "Test 4: Login endpoint"
LOGIN=$(curl -s -X POST https://api-uat.duckcode.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@duckcode.dev","password":"TestPass123!"}' \
  | jq -r '.token')
if [ ! -z "$LOGIN" ] && [ "$LOGIN" != "null" ]; then
  echo "✅ PASS: Login works"
else
  echo "❌ FAIL: Login failed"
fi
echo ""

# Test 5: Rate limiting
echo "Test 5: Rate limiting"
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://api-uat.duckcode.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}')
  if [ "$STATUS" -eq 429 ]; then
    echo "✅ PASS: Rate limiting active (blocked at attempt $i)"
    break
  fi
done
echo ""

echo "🧪 Smoke tests completed!"
```

**Run tests:**

```bash
chmod +x ~/uat-smoke-tests.sh
~/uat-smoke-tests.sh
```

### Step 2: Security Tests

```bash
# Run security test suite
cd /var/www/duckcode-uat/duckcode-observability/backend
./tests/security-test-suite.sh
```

### Step 3: Integration Tests

**Test OAuth Flow:**

```bash
# 1. Open browser: https://uat.duckcode.dev
# 2. Click "Sign Up"
# 3. Create account
# 4. Verify email (if enabled)
# 5. Login
# 6. Test IDE extension connection
# 7. Verify analytics tracking
```

### Step 4: Load Testing (Optional)

```bash
# Install Apache Bench
sudo apt-get install -y apache2-utils

# Test backend performance
ab -n 1000 -c 10 https://api-uat.duckcode.dev/api/health

# Test login endpoint
ab -n 100 -c 5 -p login.json -T application/json https://api-uat.duckcode.dev/api/auth/login

# Create login.json
echo '{"email":"test1@duckcode.dev","password":"TestPass123!"}' > login.json
```

---

## Data Management

### Step 1: Reset UAT Database

```bash
# Create reset script
nano ~/reset-uat-database.sh
```

**Add script:**

```bash
#!/bin/bash

echo "⚠️  WARNING: This will delete all UAT data!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "Resetting UAT database..."

# Truncate all tables
psql $UAT_DATABASE_URL << EOF
TRUNCATE TABLE duckcode.conversation_analytics CASCADE;
TRUNCATE TABLE duckcode.failed_login_attempts CASCADE;
TRUNCATE TABLE duckcode.account_lockouts CASCADE;
TRUNCATE TABLE duckcode.security_audit_log CASCADE;
TRUNCATE TABLE duckcode.ide_sessions CASCADE;
TRUNCATE TABLE duckcode.ide_auth_codes CASCADE;
TRUNCATE TABLE duckcode.users CASCADE;
EOF

# Reseed test data
psql $UAT_DATABASE_URL -f /var/www/duckcode-uat/duckcode-observability/supabase/seed-uat.sql

echo "✅ UAT database reset complete!"
```

**Make executable:**

```bash
chmod +x ~/reset-uat-database.sh
```

### Step 2: Sync Production Data to UAT (Anonymized)

```bash
# Create sync script
nano ~/sync-prod-to-uat.sh
```

**Add script:**

```bash
#!/bin/bash

echo "Syncing production data to UAT (anonymized)..."

# 1. Backup production
pg_dump $PROD_DATABASE_URL -n duckcode -F c -f /tmp/prod-backup.dump

# 2. Restore to UAT
pg_restore -d $UAT_DATABASE_URL --clean --if-exists /tmp/prod-backup.dump

# 3. Anonymize sensitive data
psql $UAT_DATABASE_URL << EOF
-- Anonymize emails
UPDATE duckcode.users 
SET email = 'test' || id || '@duckcode.dev',
    full_name = 'Test User ' || id;

-- Clear sensitive fields
UPDATE duckcode.security_audit_log 
SET ip_address = '127.0.0.1',
    user_agent = 'Test Agent';

-- Clear API keys (if stored)
-- Add your anonymization logic here
EOF

echo "✅ Data sync complete!"
```

---

## Troubleshooting

### Common Issues

#### 1. Backend Won't Start

```bash
# Check logs
pm2 logs duckcode-uat-backend

# Check port
sudo lsof -i :3002

# Restart
pm2 restart duckcode-uat-backend
```

#### 2. Frontend Shows 502 Error

```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check backend is running
curl http://localhost:3002/api/health

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

#### 3. Database Connection Failed

```bash
# Test connection
psql $UAT_DATABASE_URL -c "SELECT 1;"

# Check credentials in .env
grep SUPABASE .env

# Verify Supabase project is running
# https://supabase.com/dashboard
```

#### 4. SSL Certificate Issues

```bash
# Renew certificates
sudo certbot renew

# Check certificates
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal -d uat.duckcode.dev
```

---

## UAT Deployment Checklist

### Pre-Deployment

- [ ] UAT server provisioned
- [ ] DNS records configured
- [ ] Supabase UAT project created
- [ ] Test data prepared

### Deployment

- [ ] Backend deployed (port 3002)
- [ ] Frontend built and deployed
- [ ] Nginx configured
- [ ] SSL certificates installed
- [ ] PM2 configured

### Testing

- [ ] Smoke tests passing
- [ ] Security tests passing
- [ ] OAuth flow working
- [ ] IDE extension connects
- [ ] Analytics tracking works
- [ ] UAT banner visible

### Documentation

- [ ] Test accounts documented
- [ ] Known issues logged
- [ ] Testing procedures shared
- [ ] Team trained on UAT usage

---

## UAT Best Practices

### Do's ✅

- **Use test data only**
- **Test thoroughly before promoting to production**
- **Keep UAT in sync with production code**
- **Document test scenarios**
- **Reset UAT database regularly**
- **Monitor UAT performance**

### Don'ts ❌

- **Don't use real customer data**
- **Don't skip UAT testing**
- **Don't leave UAT outdated**
- **Don't use production credentials**
- **Don't ignore UAT errors**
- **Don't deploy untested code to production**

---

## UAT URLs

**Frontend:** https://uat.duckcode.dev  
**Backend API:** https://api-uat.duckcode.dev  
**Health Check:** https://api-uat.duckcode.dev/api/health  
**Supabase:** https://supabase.com/dashboard/project/your-uat-project

---

## Test Accounts

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| test1@duckcode.dev | TestPass123! | user | General testing |
| test2@duckcode.dev | TestPass123! | user | Multi-user testing |
| admin@duckcode.dev | AdminPass123! | admin | Admin features |

---

## Conclusion

Your UAT environment is now set up and ready for testing! 🧪

**Next Steps:**
1. Run smoke tests
2. Test new features
3. Document findings
4. Fix issues
5. Promote to production

---

**UAT Deployment Date:** _______________  
**Deployed By:** _______________  
**Version:** 1.0.0  
**Status:** ✅ UAT READY
