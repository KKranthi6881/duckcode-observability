#!/bin/bash

# =====================================================
# AI Documentation API Test Script
# Tests all endpoints with authentication
# =====================================================

# Configuration (update these values)
API_URL="${API_URL:-http://localhost:3000/api}"
ORG_ID="${TEST_ORG_ID:-your-org-id}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token}"
OBJECT_ID1="${TEST_OBJECT_IDS%%,*}"  # First object ID
OBJECT_ID2=$(echo "$TEST_OBJECT_IDS" | cut -d',' -f2)  # Second object ID

echo "🧪 Testing AI Documentation API"
echo "================================"
echo "API URL: $API_URL"
echo "Org ID: $ORG_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test health endpoint
echo -e "${BLUE}1. Testing Health Endpoint${NC}"
echo "GET $API_URL/health"
RESPONSE=$(curl -s "$API_URL/health")
echo "$RESPONSE" | jq '.'
echo ""

# Test create job
echo -e "${BLUE}2. Creating Documentation Job${NC}"
echo "POST $API_URL/ai-documentation/organizations/$ORG_ID/jobs"
JOB_RESPONSE=$(curl -s -X POST "$API_URL/ai-documentation/organizations/$ORG_ID/jobs" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"objectIds\": [\"$OBJECT_ID1\", \"$OBJECT_ID2\"],
    \"options\": {
      \"skipExisting\": false,
      \"regenerateAll\": true,
      \"maxRetries\": 3
    }
  }")

echo "$JOB_RESPONSE" | jq '.'
JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.jobId')
echo ""

if [ "$JOB_ID" != "null" ] && [ -n "$JOB_ID" ]; then
  echo -e "${GREEN}✅ Job created: $JOB_ID${NC}"
  echo ""
  
  # Wait a few seconds
  echo "⏳ Waiting 5 seconds for job to start processing..."
  sleep 5
  echo ""
  
  # Test get job status
  echo -e "${BLUE}3. Getting Job Status${NC}"
  echo "GET $API_URL/ai-documentation/jobs/$JOB_ID"
  STATUS_RESPONSE=$(curl -s "$API_URL/ai-documentation/jobs/$JOB_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN")
  echo "$STATUS_RESPONSE" | jq '.'
  echo ""
  
  # Test list jobs
  echo -e "${BLUE}4. Listing All Jobs${NC}"
  echo "GET $API_URL/ai-documentation/organizations/$ORG_ID/jobs"
  LIST_RESPONSE=$(curl -s "$API_URL/ai-documentation/organizations/$ORG_ID/jobs?limit=10&offset=0" \
    -H "Authorization: Bearer $AUTH_TOKEN")
  echo "$LIST_RESPONSE" | jq '.'
  echo ""
  
  # Test pause job
  echo -e "${BLUE}5. Pausing Job${NC}"
  echo "POST $API_URL/ai-documentation/jobs/$JOB_ID/pause"
  PAUSE_RESPONSE=$(curl -s -X POST "$API_URL/ai-documentation/jobs/$JOB_ID/pause" \
    -H "Authorization: Bearer $AUTH_TOKEN")
  echo "$PAUSE_RESPONSE" | jq '.'
  echo ""
  
  # Wait a moment
  sleep 2
  
  # Test cancel job
  echo -e "${BLUE}6. Cancelling Job${NC}"
  echo "POST $API_URL/ai-documentation/jobs/$JOB_ID/cancel"
  CANCEL_RESPONSE=$(curl -s -X POST "$API_URL/ai-documentation/jobs/$JOB_ID/cancel" \
    -H "Authorization: Bearer $AUTH_TOKEN")
  echo "$CANCEL_RESPONSE" | jq '.'
  echo ""
  
else
  echo -e "${RED}❌ Failed to create job${NC}"
  echo ""
fi

# Test get object documentation (may not exist yet)
echo -e "${BLUE}7. Getting Object Documentation${NC}"
echo "GET $API_URL/ai-documentation/objects/$OBJECT_ID1/documentation"
DOC_RESPONSE=$(curl -s "$API_URL/ai-documentation/objects/$OBJECT_ID1/documentation" \
  -H "Authorization: Bearer $AUTH_TOKEN")
if [ "$DOC_RESPONSE" != "" ]; then
  echo "$DOC_RESPONSE" | jq 'del(.business_narrative, .transformation_cards, .code_explanations, .business_rules, .impact_analysis) | .'
else
  echo "No documentation found (expected if not generated yet)"
fi
echo ""

echo "================================"
echo -e "${GREEN}✅ API Tests Complete!${NC}"
echo ""
echo "Available Endpoints:"
echo "  POST   /ai-documentation/organizations/:orgId/jobs"
echo "  GET    /ai-documentation/organizations/:orgId/jobs"
echo "  GET    /ai-documentation/jobs/:jobId"
echo "  POST   /ai-documentation/jobs/:jobId/cancel"
echo "  POST   /ai-documentation/jobs/:jobId/pause"
echo "  POST   /ai-documentation/jobs/:jobId/resume"
echo "  GET    /ai-documentation/objects/:objectId/documentation"
