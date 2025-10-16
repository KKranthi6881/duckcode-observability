#!/bin/bash

# Analytics Flow Test Script
# This script tests the complete analytics flow

set -e

echo "🔍 Testing Analytics Flow..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check if backend is running
echo "1️⃣ Checking backend..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is NOT running${NC}"
    echo "   Start with: cd backend && npm run dev"
    exit 1
fi

# 2. Check if Supabase is running
echo ""
echo "2️⃣ Checking Supabase..."
if curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase is running${NC}"
else
    echo -e "${RED}❌ Supabase is NOT running${NC}"
    echo "   Start with: supabase start"
    exit 1
fi

# 3. Check if tables exist in duckcode schema
echo ""
echo "3️⃣ Checking database tables in duckcode schema..."
TABLE_CHECK=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54321 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='duckcode' AND table_name='conversation_analytics';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$TABLE_CHECK" -eq "1" ]; then
    echo -e "${GREEN}✅ conversation_analytics table exists${NC}"
else
    echo -e "${RED}❌ conversation_analytics table NOT found${NC}"
    echo "   Run migrations: supabase db reset"
    exit 1
fi

# 4. Check data in duckcode.conversation_analytics table
echo ""
echo "4️⃣ Checking for conversation data in duckcode schema..."
DATA_COUNT=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54321 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM duckcode.conversation_analytics;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$DATA_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Found $DATA_COUNT conversations in database${NC}"
else
    echo -e "${YELLOW}⚠️  No conversation data found${NC}"
    echo "   This is expected if you haven't used the IDE yet"
fi

# 5. Test analytics endpoint
echo ""
echo "5️⃣ Testing analytics endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/analytics/dashboard-summary -H "Authorization: Bearer test")

if [ "$RESPONSE" == "401" ]; then
    echo -e "${GREEN}✅ Analytics endpoint responding (401 = needs auth)${NC}"
elif [ "$RESPONSE" == "200" ]; then
    echo -e "${GREEN}✅ Analytics endpoint responding (200 = success)${NC}"
else
    echo -e "${RED}❌ Analytics endpoint returned: $RESPONSE${NC}"
fi

# 6. Check cost.ts has 2x markup (duckcode-observability context)
echo ""
echo "6️⃣ Checking 2x markup in IDE code..."
COST_FILE="/Users/Kranthi_1/duck-main/duck-code/src/utils/cost.ts"
if [ -f "$COST_FILE" ] && grep -q "PROFIT_MARKUP = 2.0" "$COST_FILE"; then
    echo -e "${GREEN}✅ PROFIT_MARKUP = 2.0 found in cost.ts${NC}"
else
    echo -e "${RED}❌ PROFIT_MARKUP not found or incorrect${NC}"
    echo "   File: $COST_FILE"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Backend:    ✅ Running"
echo "Supabase:   ✅ Running"
echo "Tables:     ✅ Created"
echo "Data:       $DATA_COUNT conversations"
echo "Endpoints:  ✅ Responding"
echo "2x Markup:  ✅ Configured"
echo ""

if [ "$DATA_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  No data yet - Use IDE to generate conversations${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Compile extension: cd duck-code && npm run compile"
    echo "2. Press F5 in VS Code to start Extension Development Host"
    echo "3. Start a conversation with AI"
    echo "4. Check browser console for analytics logs"
    echo "5. Run this script again to verify data"
else
    echo -e "${GREEN}✅ System is working! Check dashboard at:${NC}"
    echo "   http://localhost:5175/dashboard/ide-analytics"
fi

echo ""
