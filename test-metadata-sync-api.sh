#!/bin/bash

# Test script for Metadata Sync API
# Phase 1: Backend API Foundation

echo "========================================="
echo "Testing Metadata Sync API Endpoints"
echo "========================================="
echo ""

# Configuration
BASE_URL="http://localhost:3001/api/metadata-sync"
ORG_ID="YOUR_ORG_ID_HERE"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Get Sync Package
echo "Test 1: GET /organizations/:orgId/sync-package"
echo "Request: GET ${BASE_URL}/organizations/${ORG_ID}/sync-package?limit=10"
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${BASE_URL}/organizations/${ORG_ID}/sync-package?limit=10&include_documentation=false" \
  -H "Authorization: Bearer ${JWT_TOKEN}")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ SUCCESS${NC} (Status: $http_code)"
  echo "Response preview:"
  echo "$body" | jq -r '.sync_metadata' 2>/dev/null || echo "$body"
else
  echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
  echo "Error: $body"
fi
echo ""

# Test 2: Match Workspace Connections
echo "Test 2: POST /organizations/:orgId/connections/match-workspace"
echo "Request: POST ${BASE_URL}/organizations/${ORG_ID}/connections/match-workspace"
response=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/organizations/${ORG_ID}/connections/match-workspace" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"workspace_identifier": "jaffle_shop"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ SUCCESS${NC} (Status: $http_code)"
  echo "Matched connections:"
  echo "$body" | jq -r '.matched_connections | length' 2>/dev/null || echo "$body"
else
  echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
  echo "Error: $body"
fi
echo ""

# Test 3: Get Connections
echo "Test 3: GET /organizations/:orgId/connections"
echo "Request: GET ${BASE_URL}/organizations/${ORG_ID}/connections"
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${BASE_URL}/organizations/${ORG_ID}/connections" \
  -H "Authorization: Bearer ${JWT_TOKEN}")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ SUCCESS${NC} (Status: $http_code)"
  echo "Total connections:"
  echo "$body" | jq -r '.connections | length' 2>/dev/null || echo "$body"
else
  echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
  echo "Error: $body"
fi
echo ""

# Test 4: Get Documentation
echo "Test 4: GET /organizations/:orgId/documentation"
echo "Request: GET ${BASE_URL}/organizations/${ORG_ID}/documentation"
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${BASE_URL}/organizations/${ORG_ID}/documentation" \
  -H "Authorization: Bearer ${JWT_TOKEN}")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ SUCCESS${NC} (Status: $http_code)"
  echo "Documentation count:"
  echo "$body" | jq -r '.documentation | length' 2>/dev/null || echo "$body"
else
  echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
  echo "Error: $body"
fi
echo ""

# Test 5: Register IDE Session
echo "Test 5: POST /organizations/:orgId/ide-sessions"
echo "Request: POST ${BASE_URL}/organizations/${ORG_ID}/ide-sessions"
response=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/organizations/${ORG_ID}/ide-sessions" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_identifier": "company/jaffle_shop",
    "workspace_hash": "test-hash-123",
    "ide_version": "1.0.0",
    "sync_mode": "workspace-aware",
    "connection_ids": []
  }')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ SUCCESS${NC} (Status: $http_code)"
  echo "Session ID:"
  echo "$body" | jq -r '.session_id' 2>/dev/null || echo "$body"
else
  echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
  echo "Error: $body"
fi
echo ""

echo "========================================="
echo "Testing Complete"
echo "========================================="
echo ""
echo "To run this test:"
echo "1. Update ORG_ID and JWT_TOKEN in this script"
echo "2. Make sure backend is running (npm run dev)"
echo "3. Run: ./test-metadata-sync-api.sh"
