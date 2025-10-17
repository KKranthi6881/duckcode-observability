#!/bin/bash

# =====================================================
# DuckCode Clean Reset Script
# =====================================================
# This script performs a complete clean reset:
# 1. Stops all services
# 2. Resets Supabase database
# 3. Restarts backend and frontend
# =====================================================

set -e  # Exit on error

echo "=============================================="
echo "🔄 DuckCode Clean Reset"
echo "=============================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop services
echo -e "${YELLOW}Step 1: Stopping all services...${NC}"
pkill -f "node.*duckcode-observability" || true
pkill -f "vite.*5173" || true
echo -e "${GREEN}✓ Services stopped${NC}"
echo ""

# Step 2: Reset database
echo -e "${YELLOW}Step 2: Resetting Supabase database...${NC}"
cd supabase
echo "This will drop all tables and re-run migrations..."
echo "Press Ctrl+C within 3 seconds to cancel..."
sleep 3

if supabase db reset; then
    echo -e "${GREEN}✓ Database reset successful${NC}"
else
    echo -e "${RED}✗ Database reset failed${NC}"
    echo "Please check the error above and fix any migration issues"
    exit 1
fi
cd ..
echo ""

# Step 3: Start backend
echo -e "${YELLOW}Step 3: Starting backend...${NC}"
cd backend
echo "Starting backend on port 3001..."

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found in backend/${NC}"
    echo "Please create backend/.env with required variables"
    exit 1
fi

# Start backend in background
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend failed to start (timeout)${NC}"
        echo "Check logs/backend.log for errors"
        exit 1
    fi
    sleep 1
done
cd ..
echo ""

# Step 4: Start frontend
echo -e "${YELLOW}Step 4: Starting frontend...${NC}"
cd frontend
echo "Starting frontend on port 5173..."

# Start frontend in background
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to be ready
echo "Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Frontend failed to start (timeout)${NC}"
        echo "Check logs/frontend.log for errors"
        exit 1
    fi
    sleep 1
done
cd ..
echo ""

# Success message
echo "=============================================="
echo -e "${GREEN}✅ Clean Reset Complete!${NC}"
echo "=============================================="
echo ""
echo "Services running:"
echo "  Backend:  http://localhost:3001 (PID: $BACKEND_PID)"
echo "  Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"
echo ""
echo "Logs:"
echo "  Backend:  logs/backend.log"
echo "  Frontend: logs/frontend.log"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:5173/register"
echo "  2. Create a new account"
echo "  3. Verify ONE organization is created (see CLEAN_RESET_AND_REGISTER.md)"
echo "  4. Add API key in admin panel"
echo "  5. Test API key sync in IDE"
echo ""
echo "To stop services:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "=============================================="
