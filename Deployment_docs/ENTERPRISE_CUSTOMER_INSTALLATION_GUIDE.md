# 🏢 DuckCode Enterprise - Customer Installation Guide

**Self-Hosted Installation for Enterprise Customers**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Pre-Installation Checklist](#pre-installation-checklist)
4. [Installation Methods](#installation-methods)
5. [Docker Installation (Recommended)](#docker-installation)
6. [Manual Installation](#manual-installation)
7. [Configuration](#configuration)
8. [Post-Installation](#post-installation)
9. [Maintenance](#maintenance)
10. [Support](#support)

---

## Overview

### What is DuckCode Enterprise?

DuckCode Enterprise is a **self-hosted version** of DuckCode that runs entirely on your infrastructure, providing:

✅ **Complete Data Sovereignty** - All data stays on your servers  
✅ **Enhanced Security** - Behind your firewall  
✅ **Custom Configuration** - Tailored to your needs  
✅ **Compliance Ready** - SOC 2, GDPR, HIPAA compatible  
✅ **No External Dependencies** - Fully isolated  

### Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│         YOUR INFRASTRUCTURE (Private Network)       │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Frontend   │  │   Backend    │  │ Database │ │
│  │   (Nginx)    │  │   (Node.js)  │  │(Postgres)│ │
│  │   Port 80    │  │   Port 3001  │  │ Port 5432│ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│         ↓                  ↓                ↓       │
│  ┌─────────────────────────────────────────────┐   │
│  │        Your Employees' Computers            │   │
│  │        (IDE Extension Installed)            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## System Requirements

### Minimum Requirements

| Component | Specification |
|-----------|---------------|
| **CPU** | 4 cores (2.5 GHz+) |
| **RAM** | 8 GB |
| **Storage** | 100 GB SSD |
| **OS** | Ubuntu 22.04 LTS, RHEL 8+, or Windows Server 2019+ |
| **Network** | 1 Gbps |
| **Users** | Up to 50 concurrent users |

### Recommended Requirements (100+ users)

| Component | Specification |
|-----------|---------------|
| **CPU** | 8 cores (3.0 GHz+) |
| **RAM** | 16 GB |
| **Storage** | 500 GB SSD |
| **OS** | Ubuntu 22.04 LTS |
| **Network** | 10 Gbps |
| **Users** | 100+ concurrent users |

### Software Requirements

- **Docker** 20.10+ and Docker Compose 2.0+ (for Docker installation)
- **Node.js** 18+ LTS (for manual installation)
- **PostgreSQL** 14+ (included in Docker installation)
- **Nginx** 1.18+ (included in Docker installation)

---

## Pre-Installation Checklist

### Before You Begin

- [ ] **Server provisioned** with required specifications
- [ ] **Network access** configured (ports 80, 443, 5432)
- [ ] **SSL certificates** obtained (or use self-signed)
- [ ] **Domain name** configured (e.g., duckcode.yourcompany.com)
- [ ] **Firewall rules** configured
- [ ] **Backup strategy** planned
- [ ] **IT team** briefed on installation
- [ ] **License key** obtained from DuckCode

### Network Requirements

**Required Ports:**

| Port | Protocol | Purpose | Access |
|------|----------|---------|--------|
| 80 | HTTP | Web interface (redirects to 443) | Internal network |
| 443 | HTTPS | Secure web interface | Internal network |
| 3001 | HTTP | Backend API (behind Nginx) | Internal only |
| 5432 | TCP | PostgreSQL database | Internal only |

**Firewall Configuration:**

```bash
# Allow HTTP/HTTPS from internal network
Allow: 80/tcp from 10.0.0.0/8
Allow: 443/tcp from 10.0.0.0/8

# Block external access
Deny: 80/tcp from 0.0.0.0/0
Deny: 443/tcp from 0.0.0.0/0
```

---

## Installation Methods

### Method 1: Docker Installation (Recommended)

**Pros:**
- ✅ Fastest installation (15 minutes)
- ✅ All dependencies included
- ✅ Easy updates
- ✅ Consistent environment
- ✅ Simple rollback

**Cons:**
- ⚠️ Requires Docker knowledge
- ⚠️ Slightly more resource usage

### Method 2: Manual Installation

**Pros:**
- ✅ Full control over configuration
- ✅ Better performance
- ✅ Easier debugging

**Cons:**
- ⚠️ Longer installation (1-2 hours)
- ⚠️ More maintenance required
- ⚠️ Manual dependency management

---

## Docker Installation

### Step 1: Install Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Download DuckCode Enterprise

```bash
# Create installation directory
sudo mkdir -p /opt/duckcode
cd /opt/duckcode

# Download installation package
# (Provided by DuckCode sales team)
wget https://releases.duckcode.dev/enterprise/duckcode-enterprise-v1.0.0.tar.gz

# Extract
tar -xzf duckcode-enterprise-v1.0.0.tar.gz
cd duckcode-enterprise
```

### Step 3: Run Automated Installer

```bash
# Make installer executable
chmod +x install.sh

# Run installer
sudo ./install.sh
```

**The installer will:**
1. ✅ Generate unique JWT_SECRET
2. ✅ Create database
3. ✅ Apply migrations
4. ✅ Configure Nginx
5. ✅ Start all services
6. ✅ Run health checks

**Installation Output:**

```
================================================
DuckCode Enterprise Installer
================================================

[1/8] Checking system requirements...
✓ Docker installed
✓ Docker Compose installed
✓ Sufficient disk space
✓ Sufficient memory

[2/8] Generating security keys...
✓ JWT_SECRET generated
✓ Database password generated
✓ Admin password generated

[3/8] Creating configuration files...
✓ .env file created
✓ docker-compose.yml configured
✓ nginx.conf configured

[4/8] Starting database...
✓ PostgreSQL started
✓ Database created

[5/8] Applying migrations...
✓ All migrations applied
✓ Database schema ready

[6/8] Starting backend...
✓ Backend API started
✓ Health check passed

[7/8] Starting frontend...
✓ Frontend built
✓ Nginx started

[8/8] Running post-installation checks...
✓ All services running
✓ Health checks passed

================================================
Installation Complete! 🎉
================================================

Access DuckCode at: https://duckcode.yourcompany.com

Admin Credentials:
  Email: admin@yourcompany.com
  Password: <generated-password>

Next Steps:
1. Login with admin credentials
2. Change admin password
3. Create user accounts
4. Configure IDE extension

Installation log: /opt/duckcode/install.log
```

### Step 4: Verify Installation

```bash
# Check all containers are running
docker-compose ps

# Expected output:
# NAME                STATUS              PORTS
# duckcode-frontend   Up 2 minutes        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# duckcode-backend    Up 2 minutes        3001/tcp
# duckcode-db         Up 2 minutes        5432/tcp

# Check logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:3001/api/health
# Should return: {"status":"ok"}
```

---

## Manual Installation

### Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 14
sudo apt-get install -y postgresql postgresql-contrib

# Install Nginx
sudo apt-get install -y nginx

# Install Git
sudo apt-get install -y git

# Verify installations
node --version  # v18.x.x
psql --version  # 14.x
nginx -v        # 1.18+
```

### Step 2: Create Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE duckcode;
CREATE USER duckcode_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE duckcode TO duckcode_user;

# Create schema
\c duckcode
CREATE SCHEMA duckcode;
GRANT ALL ON SCHEMA duckcode TO duckcode_user;

# Exit
\q
```

### Step 3: Install Backend

```bash
# Create application directory
sudo mkdir -p /opt/duckcode
cd /opt/duckcode

# Extract installation package
tar -xzf duckcode-enterprise-v1.0.0.tar.gz
cd duckcode-enterprise/backend

# Install dependencies
npm ci --production

# Create .env file
nano .env
```

**Add configuration:**

```bash
NODE_ENV=production
PORT=3001

# Generate with: openssl rand -base64 32
JWT_SECRET=<GENERATE_UNIQUE_SECRET>

# Database connection
DATABASE_URL=postgresql://duckcode_user:your-secure-password@localhost:5432/duckcode
DATABASE_SCHEMA=duckcode

# Your company domain
FRONTEND_URL=https://duckcode.yourcompany.com

# Security settings
RATE_LIMIT_ENABLED=true
LOCKOUT_ENABLED=true
AUDIT_LOG_ENABLED=true
PASSWORD_MIN_LENGTH=12
```

**Apply migrations:**

```bash
# Install migration tool
npm install -g db-migrate

# Run migrations
npm run migrate

# Verify
psql -U duckcode_user -d duckcode -c "\dt duckcode.*"
```

**Start backend:**

```bash
# Install PM2
sudo npm install -g pm2

# Start backend
pm2 start dist/server.js --name duckcode-backend

# Configure startup
pm2 startup
pm2 save
```

### Step 4: Install Frontend

```bash
# Navigate to frontend
cd /opt/duckcode/duckcode-enterprise/frontend

# Build
npm ci
npm run build

# Copy to web root
sudo mkdir -p /var/www/duckcode
sudo cp -r dist/* /var/www/duckcode/
```

### Step 5: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/duckcode
```

**Add configuration:**

```nginx
server {
    listen 80;
    server_name duckcode.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name duckcode.yourcompany.com;

    # SSL certificates
    ssl_certificate /etc/ssl/certs/duckcode.crt;
    ssl_certificate_key /etc/ssl/private/duckcode.key;

    # Frontend
    root /var/www/duckcode;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/duckcode /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Configuration

### Step 1: Admin Setup

```bash
# Access DuckCode
https://duckcode.yourcompany.com

# Login with admin credentials
# (Provided in installation output)

# Change admin password
1. Click profile icon
2. Go to Security
3. Change Password
```

### Step 2: Create User Accounts

**Option A: Manual Creation**

```bash
# Admin dashboard
1. Go to Users
2. Click "Add User"
3. Enter details
4. Send invitation email
```

**Option B: LDAP/Active Directory Integration**

```bash
# Edit backend .env
nano /opt/duckcode/duckcode-enterprise/backend/.env

# Add LDAP configuration
LDAP_ENABLED=true
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=yourcompany,dc=com
LDAP_BIND_PASSWORD=your-ldap-password
LDAP_SEARCH_BASE=ou=users,dc=yourcompany,dc=com
LDAP_SEARCH_FILTER=(uid={{username}})

# Restart backend
pm2 restart duckcode-backend
```

**Option C: SAML SSO**

```bash
# Contact DuckCode support for SAML configuration
# Requires Enterprise Plus license
```

### Step 3: Configure IDE Extension

**For Your Employees:**

```
1. Install DuckCode extension from VS Code Marketplace
2. Open VS Code
3. Click DuckCode icon
4. Click "Sign In"
5. Enter: https://duckcode.yourcompany.com
6. Login with company credentials
7. Start using DuckCode
```

**Custom Extension Configuration:**

```json
// settings.json
{
  "duckcode.serverUrl": "https://duckcode.yourcompany.com",
  "duckcode.autoConnect": true,
  "duckcode.telemetry": false
}
```

---

## Post-Installation

### Step 1: Security Hardening

```bash
# 1. Configure firewall
sudo ufw allow from 10.0.0.0/8 to any port 80
sudo ufw allow from 10.0.0.0/8 to any port 443
sudo ufw enable

# 2. Enable fail2ban
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban

# 3. Configure automatic updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 4. Set up log rotation
sudo nano /etc/logrotate.d/duckcode
```

**Add log rotation:**

```
/opt/duckcode/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 duckcode duckcode
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Step 2: Backup Configuration

```bash
# Create backup script
sudo nano /opt/duckcode/backup.sh
```

**Add script:**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/duckcode"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U duckcode_user duckcode | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" /opt/duckcode/duckcode-enterprise/backend/.env

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

**Schedule backups:**

```bash
chmod +x /opt/duckcode/backup.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /opt/duckcode/backup.sh >> /var/log/duckcode-backup.log 2>&1
```

### Step 3: Monitoring Setup

```bash
# Install monitoring tools
sudo apt-get install -y prometheus grafana

# Configure Prometheus
sudo nano /etc/prometheus/prometheus.yml
```

**Add DuckCode targets:**

```yaml
scrape_configs:
  - job_name: 'duckcode-backend'
    static_configs:
      - targets: ['localhost:3001']
  
  - job_name: 'duckcode-db'
    static_configs:
      - targets: ['localhost:5432']
```

---

## Maintenance

### Daily Tasks

```bash
# Check service status
docker-compose ps
# or
pm2 status

# Check logs for errors
docker-compose logs --tail=100
# or
pm2 logs --lines 100

# Check disk space
df -h

# Check database size
psql -U duckcode_user -d duckcode -c "SELECT pg_size_pretty(pg_database_size('duckcode'));"
```

### Weekly Tasks

```bash
# Review security audit logs
psql -U duckcode_user -d duckcode -c "SELECT event_type, COUNT(*) FROM duckcode.security_audit_log WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY event_type;"

# Check for updates
cd /opt/duckcode/duckcode-enterprise
git fetch
git log HEAD..origin/main --oneline

# Verify backups
ls -lh /backup/duckcode/
```

### Monthly Tasks

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Rotate logs
sudo logrotate -f /etc/logrotate.d/duckcode

# Review user access
psql -U duckcode_user -d duckcode -c "SELECT email, last_login FROM duckcode.users ORDER BY last_login DESC;"

# Performance review
pm2 monit
```

### Updating DuckCode

```bash
# 1. Backup current installation
/opt/duckcode/backup.sh

# 2. Download new version
cd /opt/duckcode
wget https://releases.duckcode.dev/enterprise/duckcode-enterprise-v1.1.0.tar.gz

# 3. Stop services
docker-compose down
# or
pm2 stop duckcode-backend

# 4. Extract new version
tar -xzf duckcode-enterprise-v1.1.0.tar.gz

# 5. Run update script
cd duckcode-enterprise
./update.sh

# 6. Start services
docker-compose up -d
# or
pm2 start duckcode-backend

# 7. Verify
curl http://localhost:3001/api/health
```

---

## Support

### Getting Help

**Documentation:**
- Installation Guide: This document
- User Manual: `/opt/duckcode/docs/user-manual.pdf`
- API Documentation: `https://duckcode.yourcompany.com/api/docs`

**Support Channels:**
- Email: enterprise-support@duckcode.dev
- Phone: +1 (555) 123-4567
- Portal: https://support.duckcode.dev

**Support Hours:**
- Standard: Monday-Friday, 9 AM - 5 PM EST
- Premium: 24/7/365

### Troubleshooting

**Issue: Services won't start**

```bash
# Check logs
docker-compose logs
# or
pm2 logs

# Check ports
sudo lsof -i :3001
sudo lsof -i :5432

# Restart services
docker-compose restart
# or
pm2 restart all
```

**Issue: Can't connect to database**

```bash
# Test connection
psql -U duckcode_user -d duckcode -c "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql

# Check credentials
grep DATABASE_URL /opt/duckcode/duckcode-enterprise/backend/.env
```

**Issue: Frontend shows 502 error**

```bash
# Check backend is running
curl http://localhost:3001/api/health

# Check Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

---

## Appendix

### A. System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Load Balancer (Optional)               │
│                  Nginx / HAProxy                    │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐         ┌────────▼───────┐
│   Frontend     │         │    Backend     │
│   (Nginx)      │◄────────┤   (Node.js)    │
│   Static Files │         │   REST API     │
└────────────────┘         └────────┬───────┘
                                    │
                           ┌────────▼───────┐
                           │   PostgreSQL   │
                           │   Database     │
                           └────────────────┘
```

### B. Port Reference

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Frontend | 80 | HTTP | Web UI (redirects to 443) |
| Frontend | 443 | HTTPS | Secure Web UI |
| Backend | 3001 | HTTP | REST API |
| Database | 5432 | TCP | PostgreSQL |
| Monitoring | 9090 | HTTP | Prometheus |
| Monitoring | 3000 | HTTP | Grafana |

### C. File Locations

| Component | Location |
|-----------|----------|
| Application | `/opt/duckcode/duckcode-enterprise/` |
| Configuration | `/opt/duckcode/duckcode-enterprise/backend/.env` |
| Logs | `/opt/duckcode/logs/` |
| Backups | `/backup/duckcode/` |
| Nginx Config | `/etc/nginx/sites-available/duckcode` |
| SSL Certificates | `/etc/ssl/certs/duckcode.crt` |

### D. Environment Variables Reference

```bash
# Core
NODE_ENV=production
PORT=3001
JWT_SECRET=<generated>

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/duckcode
DATABASE_SCHEMA=duckcode

# URLs
FRONTEND_URL=https://duckcode.yourcompany.com

# Security
RATE_LIMIT_ENABLED=true
LOCKOUT_ENABLED=true
AUDIT_LOG_ENABLED=true
PASSWORD_MIN_LENGTH=12

# LDAP (Optional)
LDAP_ENABLED=false
LDAP_URL=ldap://ldap-server:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com

# Monitoring (Optional)
SENTRY_DSN=https://xxx@sentry.io/xxx
LOG_LEVEL=info
```

---

## License

DuckCode Enterprise is licensed software. This installation is authorized for use by:

**Company:** _______________  
**License Key:** _______________  
**Valid Until:** _______________  
**Max Users:** _______________  

For license inquiries: sales@duckcode.dev

---

**Installation Guide Version:** 1.0.0  
**Last Updated:** October 3, 2025  
**Status:** ✅ PRODUCTION READY  

---

*Thank you for choosing DuckCode Enterprise!*
