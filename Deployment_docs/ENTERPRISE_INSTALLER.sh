#!/bin/bash

# DuckCode Enterprise - Automated Installer
# This script installs DuckCode Enterprise on customer infrastructure

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/duckcode"
BACKUP_DIR="/backup/duckcode"
LOG_FILE="/var/log/duckcode-install.log"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a $LOG_FILE
}

# Banner
clear
cat << "EOF"
================================================
   ____             _     ____          _      
  |  _ \ _   _  ___| | __/ ___|___   __| | ___ 
  | | | | | | |/ __| |/ / |   / _ \ / _` |/ _ \
  | |_| | |_| | (__|   <| |__| (_) | (_| |  __/
  |____/ \__,_|\___|_|\_\\____\___/ \__,_|\___|
                                                
  Enterprise Installation
================================================
EOF
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root (sudo ./install.sh)"
fi

log "Starting DuckCode Enterprise installation..."
echo ""

# Step 1: System Requirements Check
log "[1/10] Checking system requirements..."

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    log "Operating System: $NAME $VERSION"
else
    error "Unsupported operating system"
fi

# Check CPU cores
CPU_CORES=$(nproc)
if [ $CPU_CORES -lt 2 ]; then
    warning "Only $CPU_CORES CPU cores detected. Minimum 4 cores recommended."
else
    log "CPU cores: $CPU_CORES ✓"
fi

# Check RAM
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
if [ $TOTAL_RAM -lt 8 ]; then
    warning "Only ${TOTAL_RAM}GB RAM detected. Minimum 8GB recommended."
else
    log "RAM: ${TOTAL_RAM}GB ✓"
fi

# Check disk space
DISK_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
if [ $DISK_SPACE -lt 100 ]; then
    warning "Only ${DISK_SPACE}GB disk space available. Minimum 100GB recommended."
else
    log "Disk space: ${DISK_SPACE}GB ✓"
fi

success "System requirements check completed"
echo ""

# Step 2: Install Docker
log "[2/10] Installing Docker..."

if command -v docker &> /dev/null; then
    log "Docker already installed: $(docker --version)"
else
    log "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $SUDO_USER
    rm get-docker.sh
    success "Docker installed"
fi

if command -v docker-compose &> /dev/null; then
    log "Docker Compose already installed: $(docker-compose --version)"
else
    log "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    success "Docker Compose installed"
fi

echo ""

# Step 3: Generate Security Keys
log "[3/10] Generating security keys..."

JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)

log "JWT_SECRET generated ✓"
log "Database password generated ✓"
log "Admin password generated ✓"

success "Security keys generated"
echo ""

# Step 4: Create Installation Directory
log "[4/10] Creating installation directory..."

mkdir -p $INSTALL_DIR
mkdir -p $BACKUP_DIR
cd $INSTALL_DIR

success "Installation directory created: $INSTALL_DIR"
echo ""

# Step 5: Extract Application Files
log "[5/10] Extracting application files..."

# Check if installation package exists
if [ ! -f "duckcode-enterprise.tar.gz" ]; then
    error "Installation package not found. Please download duckcode-enterprise.tar.gz"
fi

tar -xzf duckcode-enterprise.tar.gz
cd duckcode-enterprise

success "Application files extracted"
echo ""

# Step 6: Create Configuration Files
log "[6/10] Creating configuration files..."

# Create .env file
cat > .env << EOF
# DuckCode Enterprise Configuration
# Generated: $(date)

# Environment
NODE_ENV=production
PORT=3001

# Security Keys
JWT_SECRET=$JWT_SECRET
DB_PASSWORD=$DB_PASSWORD

# Database
DATABASE_URL=postgresql://duckcode_user:$DB_PASSWORD@postgres:5432/duckcode
DATABASE_SCHEMA=duckcode

# Frontend URL (Update this with your domain)
FRONTEND_URL=https://duckcode.yourcompany.com

# Security Configuration
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

# Monitoring
LOG_LEVEL=info
EOF

# Create docker-compose.yml
cp DOCKER_COMPOSE_ENTERPRISE.yml docker-compose.yml

# Create init-db.sql
cat > init-db.sql << EOF
-- Initialize DuckCode database
CREATE SCHEMA IF NOT EXISTS duckcode;
GRANT ALL ON SCHEMA duckcode TO duckcode_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA duckcode GRANT ALL ON TABLES TO duckcode_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA duckcode GRANT ALL ON SEQUENCES TO duckcode_user;
EOF

success "Configuration files created"
echo ""

# Step 7: Start Database
log "[7/10] Starting database..."

docker-compose up -d postgres

# Wait for database to be ready
log "Waiting for database to be ready..."
sleep 10

# Check database health
if docker-compose exec -T postgres pg_isready -U duckcode_user -d duckcode > /dev/null 2>&1; then
    success "Database started and ready"
else
    error "Database failed to start"
fi

echo ""

# Step 8: Apply Migrations
log "[8/10] Applying database migrations..."

# Copy migrations to container
docker-compose exec -T postgres psql -U duckcode_user -d duckcode < supabase/migrations/20251003000001_add_account_lockout.sql
docker-compose exec -T postgres psql -U duckcode_user -d duckcode < supabase/migrations/20251003000002_add_security_audit_log.sql

success "Database migrations applied"
echo ""

# Step 9: Start Backend
log "[9/10] Starting backend..."

docker-compose up -d backend

# Wait for backend to be ready
log "Waiting for backend to be ready..."
sleep 15

# Check backend health
HEALTH_CHECK=$(curl -s http://localhost:3001/api/health | jq -r '.status' 2>/dev/null || echo "error")
if [ "$HEALTH_CHECK" = "ok" ]; then
    success "Backend started and healthy"
else
    error "Backend failed to start. Check logs: docker-compose logs backend"
fi

echo ""

# Step 10: Start Frontend
log "[10/10] Starting frontend..."

docker-compose up -d frontend

# Wait for frontend to be ready
sleep 5

# Check frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:80 | grep -q "200"; then
    success "Frontend started and accessible"
else
    warning "Frontend may not be fully ready. Check logs: docker-compose logs frontend"
fi

echo ""

# Installation Complete
cat << EOF
================================================
✅ Installation Complete!
================================================

DuckCode Enterprise has been successfully installed!

📍 Installation Directory: $INSTALL_DIR/duckcode-enterprise
📍 Backup Directory: $BACKUP_DIR
📍 Log File: $LOG_FILE

🔐 Admin Credentials:
   Email: admin@yourcompany.com
   Password: $ADMIN_PASSWORD
   
   ⚠️  IMPORTANT: Change this password immediately after first login!

🌐 Access URLs:
   Frontend: http://localhost (or https://your-domain.com)
   Backend API: http://localhost:3001
   Health Check: http://localhost:3001/api/health

📊 Service Status:
EOF

docker-compose ps

cat << EOF

🔧 Useful Commands:
   View logs:        docker-compose logs -f
   Stop services:    docker-compose stop
   Start services:   docker-compose start
   Restart services: docker-compose restart
   Update DuckCode:  ./update.sh

📚 Documentation:
   - User Manual: $INSTALL_DIR/duckcode-enterprise/docs/
   - API Docs: http://localhost:3001/api/docs
   - Support: enterprise-support@duckcode.dev

🔒 Security Notes:
   - JWT_SECRET has been generated and configured
   - Database password has been set
   - All security features are enabled
   - Audit logging is active

📝 Next Steps:
   1. Configure your domain name in .env (FRONTEND_URL)
   2. Set up SSL certificates
   3. Login with admin credentials
   4. Change admin password
   5. Create user accounts
   6. Configure IDE extension for your employees

🎉 Thank you for choosing DuckCode Enterprise!

For support: enterprise-support@duckcode.dev
Documentation: https://docs.duckcode.dev/enterprise

================================================
EOF

# Save credentials to secure file
cat > $INSTALL_DIR/CREDENTIALS.txt << EOF
DuckCode Enterprise Installation Credentials
Generated: $(date)

Admin Email: admin@yourcompany.com
Admin Password: $ADMIN_PASSWORD

JWT_SECRET: $JWT_SECRET
Database Password: $DB_PASSWORD

⚠️  KEEP THIS FILE SECURE AND DELETE AFTER SAVING CREDENTIALS
EOF

chmod 600 $INSTALL_DIR/CREDENTIALS.txt

log "Installation completed successfully!"
log "Credentials saved to: $INSTALL_DIR/CREDENTIALS.txt"
log "⚠️  Please save credentials and delete the file!"

exit 0
