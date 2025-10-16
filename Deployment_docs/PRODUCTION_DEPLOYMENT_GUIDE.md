# 🚀 DuckCode Production Deployment Guide

**Complete Guide for SaaS Production Deployment**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Database Setup (Supabase)](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [SSL & Domain Configuration](#ssl--domain-configuration)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security Hardening](#security-hardening)
9. [Backup & Recovery](#backup--recovery)
10. [Scaling & Performance](#scaling--performance)

---

## Prerequisites

### Required Services

- **Cloud Provider:** AWS, GCP, Azure, or DigitalOcean
- **Domain Name:** e.g., `duckcode.dev`
- **Supabase Account:** For production database
- **GitHub Account:** For code repository
- **SSL Certificate:** Let's Encrypt (free) or paid

### Required Tools

```bash
# On your production server
- Node.js 18+ LTS
- npm or yarn
- PM2 (process manager)
- Nginx (reverse proxy)
- Git
- Certbot (SSL certificates)
```

### Estimated Costs (Monthly)

| Service | Provider | Cost |
|---------|----------|------|
| **Server** | DigitalOcean Droplet (4GB RAM) | $24/month |
| **Database** | Supabase Pro | $25/month |
| **Domain** | Namecheap | $12/year |
| **SSL** | Let's Encrypt | Free |
| **CDN** | Cloudflare | Free |
| **Total** | | ~$50/month |

---

## Infrastructure Setup

### Step 1: Provision Server

#### Option A: DigitalOcean (Recommended for Startups)

```bash
# 1. Create Droplet
- OS: Ubuntu 22.04 LTS
- Plan: Basic ($24/mo - 4GB RAM, 2 vCPUs, 80GB SSD)
- Datacenter: Choose closest to your users
- Add SSH key for secure access

# 2. Connect to server
ssh root@your-server-ip

# 3. Create non-root user
adduser duckcode
usermod -aG sudo duckcode
su - duckcode
```

#### Option B: AWS EC2

```bash
# 1. Launch EC2 Instance
- AMI: Ubuntu Server 22.04 LTS
- Instance Type: t3.medium (2 vCPU, 4GB RAM)
- Storage: 80GB GP3
- Security Group: Allow ports 22, 80, 443

# 2. Connect
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. Update system
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Install Git
sudo apt-get install -y git

# Install Certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx

# Install PostgreSQL client (for database management)
sudo apt-get install -y postgresql-client
```

---

## Database Setup

### Step 1: Create Supabase Production Project

```bash
# 1. Go to https://supabase.com/dashboard
# 2. Click "New Project"
# 3. Configure:
   - Name: duckcode-production
   - Database Password: <generate-strong-password>
   - Region: Choose closest to your server
   - Plan: Pro ($25/month)

# 4. Wait for project to be created (~2 minutes)

# 5. Note down credentials:
   - Project URL: https://xxxxx.supabase.co
   - Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   - Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   - Database URL: postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
```

### Step 2: Configure Database

```bash
# 1. Install Supabase CLI on your local machine
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link to production project
cd /path/to/duckcode-observability
supabase link --project-ref your-project-ref

# 4. Apply all migrations
supabase db push

# 5. Verify tables created
supabase db diff
```

### Step 3: Configure RLS Policies

```sql
-- Connect to Supabase SQL Editor
-- https://supabase.com/dashboard/project/xxxxx/sql

-- Disable RLS for service_role (backend uses service_role key)
ALTER TABLE duckcode.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.ide_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.ide_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.conversation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so backend can access all tables
-- No additional policies needed for service_role
```

---

## Backend Deployment

### Step 1: Clone Repository

```bash
# SSH into production server
ssh duckcode@your-server-ip

# Create application directory
sudo mkdir -p /var/www/duckcode
sudo chown -R duckcode:duckcode /var/www/duckcode
cd /var/www/duckcode

# Clone repository
git clone https://github.com/your-org/duckcode-observability.git
cd duckcode-observability/backend

# Checkout production branch (if you have one)
git checkout production
```

### Step 2: Configure Environment

```bash
# Create production .env file
nano .env
```

**Add the following configuration:**

```bash
# ============================================
# Production Environment Configuration
# ============================================

# Environment
NODE_ENV=production
PORT=3001

# ============================================
# JWT Configuration (CRITICAL)
# ============================================
# Generate with: openssl rand -base64 32
JWT_SECRET=<GENERATE_UNIQUE_SECRET_HERE>

# ============================================
# Supabase Production Configuration
# ============================================
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SCHEMA=duckcode

# ============================================
# Frontend URL
# ============================================
FRONTEND_URL=https://app.duckcode.dev

# ============================================
# Security Configuration
# ============================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_REGISTRATION_MAX=3
RATE_LIMIT_REGISTRATION_WINDOW_MS=3600000

LOCKOUT_ENABLED=true
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
LOCKOUT_TRACKING_WINDOW_MINUTES=15

PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=true

AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=365

SESSION_WEB_EXPIRY_DAYS=30
SESSION_IDE_EXPIRY_DAYS=7
SESSION_INVALIDATE_ON_PASSWORD_CHANGE=true
SESSION_MAX_CONCURRENT=5

# ============================================
# Email Configuration (Optional)
# ============================================
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_FROM=noreply@duckcode.dev
EMAIL_PROVIDER=supabase

# ============================================
# Monitoring (Optional)
# ============================================
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
LOG_LEVEL=info
```

**Generate JWT_SECRET:**

```bash
# Generate secure JWT secret
openssl rand -base64 32

# Copy output and add to .env
# Example: JWT_SECRET=xK9mP2vN5qR7sT4wU6yA1bC3dE5fG7hJ8iL0mN2oP4q=
```

### Step 3: Install & Build

```bash
# Install dependencies (production only)
npm ci --production=false

# Build TypeScript
npm run build

# Verify build succeeded
ls -la dist/
# Should see compiled JavaScript files
```

### Step 4: Start with PM2

```bash
# Start backend with PM2
pm2 start dist/server.js --name duckcode-backend

# Configure PM2 to restart on reboot
pm2 startup
# Follow the command it outputs

# Save PM2 configuration
pm2 save

# Verify it's running
pm2 status
pm2 logs duckcode-backend

# Test backend is responding
curl http://localhost:3001/api/health
# Should return: {"status":"ok"}
```

### Step 5: Configure PM2 Ecosystem (Advanced)

```bash
# Create PM2 ecosystem file
nano ecosystem.config.js
```

**Add configuration:**

```javascript
module.exports = {
  apps: [{
    name: 'duckcode-backend',
    script: './dist/server.js',
    instances: 2, // Run 2 instances for load balancing
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Start with ecosystem:**

```bash
# Stop current instance
pm2 delete duckcode-backend

# Start with ecosystem
pm2 start ecosystem.config.js

# Save configuration
pm2 save
```

---

## Frontend Deployment

### Step 1: Build Frontend

```bash
# Navigate to frontend directory
cd /var/www/duckcode/duckcode-observability/frontend

# Create production .env
nano .env.production
```

**Add configuration:**

```bash
VITE_API_URL=https://api.duckcode.dev
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OAUTH_REDIRECT_URI=https://app.duckcode.dev/auth/callback
```

**Build for production:**

```bash
# Install dependencies
npm ci

# Build
npm run build

# Verify build
ls -la dist/
# Should see index.html, assets/, etc.
```

### Step 2: Configure Nginx for Frontend

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/duckcode-frontend
```

**Add configuration:**

```nginx
server {
    listen 80;
    server_name app.duckcode.dev;
    
    root /var/www/duckcode/duckcode-observability/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Disable cache for index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

**Enable site:**

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/duckcode-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL & Domain Configuration

### Step 1: Configure DNS

**Add DNS records at your domain registrar:**

```
Type    Name    Value               TTL
A       @       your-server-ip      3600
A       app     your-server-ip      3600
A       api     your-server-ip      3600
CNAME   www     duckcode.dev        3600
```

### Step 2: Configure Backend Nginx

```bash
# Create backend Nginx configuration
sudo nano /etc/nginx/sites-available/duckcode-backend
```

**Add configuration:**

```nginx
server {
    listen 80;
    server_name api.duckcode.dev;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no rate limit)
    location /api/health {
        proxy_pass http://localhost:3001;
        access_log off;
    }
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/duckcode-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Install SSL Certificates

```bash
# Install SSL for frontend
sudo certbot --nginx -d app.duckcode.dev

# Install SSL for backend
sudo certbot --nginx -d api.duckcode.dev

# Install SSL for main domain
sudo certbot --nginx -d duckcode.dev -d www.duckcode.dev

# Verify auto-renewal
sudo certbot renew --dry-run

# Certificates auto-renew every 60 days
```

### Step 4: Configure SSL Security

```bash
# Edit Nginx SSL configuration
sudo nano /etc/nginx/snippets/ssl-params.conf
```

**Add strong SSL configuration:**

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# HSTS (uncomment after testing)
# add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

**Include in server blocks:**

```bash
# Edit each Nginx config
sudo nano /etc/nginx/sites-available/duckcode-backend

# Add after SSL certificate lines:
include /etc/nginx/snippets/ssl-params.conf;
```

---

## Monitoring & Logging

### Step 1: Configure PM2 Monitoring

```bash
# View logs
pm2 logs duckcode-backend

# Monitor in real-time
pm2 monit

# View detailed info
pm2 show duckcode-backend

# Set up log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Step 2: Configure Nginx Logging

```bash
# Create log directory
sudo mkdir -p /var/log/nginx/duckcode

# Edit Nginx config to add custom logging
sudo nano /etc/nginx/sites-available/duckcode-backend
```

**Add logging:**

```nginx
# Add inside server block
access_log /var/log/nginx/duckcode/api-access.log;
error_log /var/log/nginx/duckcode/api-error.log;

# Custom log format for analytics
log_format duckcode '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    '$request_time $upstream_response_time';

access_log /var/log/nginx/duckcode/api-access.log duckcode;
```

### Step 3: Set Up Monitoring Dashboard (Optional)

```bash
# Install PM2 Plus for monitoring
pm2 link <secret-key> <public-key>

# Or use free alternatives:
# - Netdata: https://www.netdata.cloud/
# - Grafana + Prometheus
# - Sentry for error tracking
```

---

## Security Hardening

### Step 1: Configure Firewall

```bash
# Install UFW (Uncomplicated Firewall)
sudo apt-get install -y ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 2: Secure SSH

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Make these changes:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22  # Or change to non-standard port

# Restart SSH
sudo systemctl restart sshd
```

### Step 3: Install Fail2Ban

```bash
# Install Fail2Ban
sudo apt-get install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Configure:
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

# Start Fail2Ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
```

### Step 4: Regular Security Updates

```bash
# Enable automatic security updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Manual updates
sudo apt update && sudo apt upgrade -y
```

---

## Backup & Recovery

### Step 1: Database Backups

```bash
# Supabase Pro includes automatic daily backups
# Access via: https://supabase.com/dashboard/project/xxxxx/settings/backups

# Manual backup script
nano ~/backup-database.sh
```

**Add script:**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/duckcode"
mkdir -p $BACKUP_DIR

# Backup using pg_dump
PGPASSWORD="your-db-password" pg_dump \
  -h db.xxxxx.supabase.co \
  -U postgres \
  -d postgres \
  -n duckcode \
  -F c \
  -f "$BACKUP_DIR/duckcode_$DATE.dump"

# Keep only last 30 days
find $BACKUP_DIR -name "duckcode_*.dump" -mtime +30 -delete

echo "Backup completed: duckcode_$DATE.dump"
```

**Make executable and schedule:**

```bash
chmod +x ~/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/duckcode/backup-database.sh >> /var/log/duckcode-backup.log 2>&1
```

### Step 2: Application Backups

```bash
# Backup script
nano ~/backup-application.sh
```

**Add script:**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/duckcode-app"
APP_DIR="/var/www/duckcode/duckcode-observability"

mkdir -p $BACKUP_DIR

# Backup .env files
tar -czf "$BACKUP_DIR/env_$DATE.tar.gz" \
  $APP_DIR/backend/.env \
  $APP_DIR/frontend/.env.production

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 "$BACKUP_DIR/pm2_$DATE.dump"

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Application backup completed: $DATE"
```

### Step 3: Disaster Recovery Plan

**Create recovery documentation:**

```bash
nano ~/DISASTER_RECOVERY.md
```

**Document recovery steps:**

```markdown
# DuckCode Disaster Recovery Plan

## Database Recovery
1. Access Supabase dashboard
2. Go to Settings > Backups
3. Select backup date
4. Click "Restore"
5. Wait for restoration (5-10 minutes)

## Application Recovery
1. SSH into new server
2. Run infrastructure setup script
3. Restore .env files from backup
4. Deploy latest code from GitHub
5. Restore PM2 configuration
6. Update DNS if server IP changed

## Recovery Time Objective (RTO): 2 hours
## Recovery Point Objective (RPO): 24 hours
```

---

## Scaling & Performance

### Step 1: Enable Caching

```bash
# Install Redis for caching
sudo apt-get install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
```

**Update backend to use Redis:**

```typescript
// backend/src/config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3
});

// Cache example
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

### Step 2: Configure CDN (Cloudflare)

```bash
# 1. Sign up at https://cloudflare.com
# 2. Add your domain
# 3. Update nameservers at registrar
# 4. Enable:
   - Auto Minify (JS, CSS, HTML)
   - Brotli compression
   - HTTP/3
   - Always Use HTTPS
   - Automatic HTTPS Rewrites

# 5. Configure caching rules:
   - Cache Level: Standard
   - Browser Cache TTL: 4 hours
   - Edge Cache TTL: 2 hours
```

### Step 3: Horizontal Scaling

**Load Balancer Configuration:**

```nginx
# /etc/nginx/nginx.conf
upstream duckcode_backend {
    least_conn;
    server localhost:3001 weight=1;
    server localhost:3002 weight=1;
    keepalive 32;
}

server {
    listen 80;
    server_name api.duckcode.dev;
    
    location / {
        proxy_pass http://duckcode_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        # ... other headers
    }
}
```

**Run multiple backend instances:**

```bash
# Update ecosystem.config.js
instances: 4,  # Run 4 instances
exec_mode: 'cluster'
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Domain purchased and DNS configured
- [ ] SSL certificates ready
- [ ] Supabase production project created
- [ ] Server provisioned and secured
- [ ] All credentials documented securely

### Deployment

- [ ] Dependencies installed
- [ ] Database migrations applied
- [ ] Backend deployed and running
- [ ] Frontend built and deployed
- [ ] Nginx configured
- [ ] SSL certificates installed
- [ ] PM2 configured for auto-restart

### Post-Deployment

- [ ] Health checks passing
- [ ] SSL working (https://)
- [ ] Frontend accessible
- [ ] Backend API responding
- [ ] Authentication flow tested
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] Team notified

### Testing

- [ ] Register new account
- [ ] Login works
- [ ] IDE extension connects
- [ ] OAuth flow completes
- [ ] Analytics tracking works
- [ ] Security features active
- [ ] Rate limiting tested
- [ ] Account lockout tested

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
pm2 logs duckcode-backend

# Common issues:
# 1. Port already in use
sudo lsof -i :3001
sudo kill -9 <PID>

# 2. Missing JWT_SECRET
grep JWT_SECRET .env

# 3. Database connection failed
psql $SUPABASE_URL -c "SELECT 1;"
```

### Frontend Not Loading

```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check logs
sudo tail -f /var/log/nginx/error.log

# Rebuild frontend
cd /var/www/duckcode/duckcode-observability/frontend
npm run build
```

### SSL Issues

```bash
# Renew certificates
sudo certbot renew

# Check certificate
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor PM2 status
- Check error logs
- Verify backups completed

**Weekly:**
- Review security audit logs
- Check disk space
- Update dependencies

**Monthly:**
- Security updates
- Performance review
- Cost optimization

### Getting Help

- **Documentation:** This guide
- **Logs:** `/var/log/nginx/` and `pm2 logs`
- **Monitoring:** PM2 dashboard
- **Support:** Your team's Slack channel

---

## Conclusion

Your DuckCode SaaS platform is now deployed to production! 🎉

**Next Steps:**
1. Test thoroughly
2. Monitor for 24 hours
3. Announce to users
4. Scale as needed

**Production URLs:**
- Frontend: https://app.duckcode.dev
- Backend API: https://api.duckcode.dev
- Health Check: https://api.duckcode.dev/api/health

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Version:** 1.0.0  
**Status:** ✅ PRODUCTION READY
