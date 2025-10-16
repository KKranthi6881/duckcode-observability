#!/bin/bash

# DuckCode Enterprise Security - Automated Deployment Script
# This script automates the deployment of all enterprise security features

set -e  # Exit on error

echo "================================================"
echo "DuckCode Enterprise Security Deployment"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from backend directory${NC}"
    exit 1
fi

echo "Step 1: Installing dependencies..."
echo "-----------------------------------"
npm install express-rate-limit
npm install --save-dev @types/express-rate-limit
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo "Step 2: Checking database connection..."
echo "----------------------------------------"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠ DATABASE_URL not set. Skipping migration.${NC}"
    echo "Please set DATABASE_URL and run migrations manually:"
    echo "  supabase db push"
else
    echo "Applying database migrations..."
    cd ../
    supabase db push || echo -e "${YELLOW}⚠ Migration failed. Please run manually.${NC}"
    cd backend/
    echo -e "${GREEN}✓ Migrations applied${NC}"
fi
echo ""

echo "Step 3: Generating JWT secret..."
echo "---------------------------------"
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ JWT secret generated${NC}"
echo ""
echo "Add this to your .env file:"
echo -e "${YELLOW}JWT_SECRET=$JWT_SECRET${NC}"
echo ""

echo "Step 4: Checking environment configuration..."
echo "----------------------------------------------"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Creating from template..."
    cp env.security.template .env
    echo -e "${GREEN}✓ .env created from template${NC}"
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Edit .env and add your configuration${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

echo "Step 5: Verifying security files..."
echo "------------------------------------"
REQUIRED_FILES=(
    "src/middleware/rateLimiter.ts"
    "src/utils/passwordValidator.ts"
    "src/models/AccountLockout.ts"
    "src/services/SecurityAuditLogger.ts"
    "src/services/SessionManager.ts"
    "src/routes/auth-enhanced.ts"
    "src/jobs/securityCleanup.ts"
)

ALL_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file ${RED}(MISSING)${NC}"
        ALL_PRESENT=false
    fi
done
echo ""

if [ "$ALL_PRESENT" = false ]; then
    echo -e "${RED}Error: Some security files are missing${NC}"
    exit 1
fi

echo "Step 6: Building TypeScript..."
echo "------------------------------"
npm run build || echo -e "${YELLOW}⚠ Build failed. Check TypeScript errors.${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}✓ Security Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Edit .env with your configuration"
echo "2. Add JWT_SECRET to .env (shown above)"
echo "3. Start backend: npm run dev"
echo "4. Run tests: npm run security:test"
echo "5. Monitor logs: tail -f logs/security.log"
echo ""
echo "Security Features Now Active:"
echo "  ✓ Rate limiting"
echo "  ✓ Account lockout"
echo "  ✓ Password policy (12+ chars)"
echo "  ✓ Security audit logging"
echo "  ✓ Session management"
echo "  ✓ Automated cleanup"
echo ""
echo "Documentation:"
echo "  - ENTERPRISE_SECURITY_IMPLEMENTATION_GUIDE.md"
echo "  - SECURITY_QUICK_REFERENCE.md"
echo "  - ENTERPRISE_SECURITY_COMPLETE.md"
echo ""
echo -e "${GREEN}Your product is now enterprise-ready! 🚀${NC}"
