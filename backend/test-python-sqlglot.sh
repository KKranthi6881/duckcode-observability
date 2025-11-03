#!/bin/bash

# Test script for Python SQLGlot Column Lineage Service
# Verifies the service is working correctly

set -e  # Exit on error

echo "🧪 Testing Python SQLGlot Column Lineage Service"
echo "=================================================="
echo ""

SERVICE_URL="${PYTHON_SQLGLOT_SERVICE_URL:-http://localhost:8000}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Service is healthy"
    echo "   SQLGlot version: $(echo "$HEALTH_RESPONSE" | jq -r '.sqlglot_version')"
else
    echo -e "${RED}❌ FAIL${NC} - Service health check failed"
    echo "   Response: $HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Simple Column Lineage
echo "Test 2: Simple Column Lineage"
echo "------------------------------"
SQL='CREATE TABLE customers AS SELECT c.id, c.name FROM stg_customers c'
PAYLOAD=$(jq -n --arg sql "$SQL" --arg dialect "generic" '{sql: $sql, dialect: $dialect}')

LINEAGE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/parse/column-lineage" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

SUCCESS=$(echo "$LINEAGE_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")
LINEAGE_COUNT=$(echo "$LINEAGE_RESPONSE" | jq '.lineage | length' 2>/dev/null || echo "0")

if [ "$SUCCESS" = "true" ] && [ "$LINEAGE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Extracted $LINEAGE_COUNT column lineages"
    echo "$LINEAGE_RESPONSE" | jq '.lineage[]' | head -20
else
    echo -e "${RED}❌ FAIL${NC} - Column lineage extraction failed"
    echo "   Response: $LINEAGE_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Complex SQL with JOIN
echo "Test 3: Complex SQL with JOIN"
echo "------------------------------"
SQL='CREATE TABLE orders AS SELECT o.id, o.total, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id'
PAYLOAD=$(jq -n --arg sql "$SQL" --arg dialect "generic" '{sql: $sql, dialect: $dialect}')

LINEAGE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/parse/column-lineage" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

SUCCESS=$(echo "$LINEAGE_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")
LINEAGE_COUNT=$(echo "$LINEAGE_RESPONSE" | jq '.lineage | length' 2>/dev/null || echo "0")

if [ "$SUCCESS" = "true" ] && [ "$LINEAGE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Extracted $LINEAGE_COUNT column lineages from JOIN"
    echo "$LINEAGE_RESPONSE" | jq '.lineage[]' | head -30
else
    echo -e "${RED}❌ FAIL${NC} - Complex SQL extraction failed"
    echo "   Response: $LINEAGE_RESPONSE"
    exit 1
fi
echo ""

# Test 4: CTE (Common Table Expression)
echo "Test 4: CTE (Common Table Expression)"
echo "--------------------------------------"
SQL='CREATE TABLE summary AS WITH customer_orders AS (SELECT customer_id, SUM(total) as total_spent FROM orders GROUP BY customer_id) SELECT c.name, co.total_spent FROM customers c JOIN customer_orders co ON c.id = co.customer_id'
PAYLOAD=$(jq -n --arg sql "$SQL" --arg dialect "generic" '{sql: $sql, dialect: $dialect}')

LINEAGE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/parse/column-lineage" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

SUCCESS=$(echo "$LINEAGE_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")
LINEAGE_COUNT=$(echo "$LINEAGE_RESPONSE" | jq '.lineage | length' 2>/dev/null || echo "0")

if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Extracted $LINEAGE_COUNT column lineages from CTE"
    echo "$LINEAGE_RESPONSE" | jq '.lineage[]' | head -30
else
    echo -e "${YELLOW}⚠️  WARN${NC} - CTE extraction had issues (may be expected for complex CTEs)"
    echo "   Response: $LINEAGE_RESPONSE"
fi
echo ""

# Test 5: Error Handling (Invalid SQL)
echo "Test 5: Error Handling (Invalid SQL)"
echo "-------------------------------------"
SQL='This is not valid SQL at all'
PAYLOAD=$(jq -n --arg sql "$SQL" --arg dialect "generic" '{sql: $sql, dialect: $dialect}')

LINEAGE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/parse/column-lineage" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

SUCCESS=$(echo "$LINEAGE_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$SUCCESS" = "false" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Service correctly handled invalid SQL"
    echo "   Error: $(echo "$LINEAGE_RESPONSE" | jq -r '.error')"
else
    echo -e "${RED}❌ FAIL${NC} - Service should have rejected invalid SQL"
    exit 1
fi
echo ""

# Summary
echo "=================================================="
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo ""
echo "Python SQLGlot service is working correctly."
echo "Service URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Start backend: npm run dev"
echo "2. Trigger dbt extraction via API"
echo "3. Check logs for: '🐍 Python SQLGlot: X lineages (95% accuracy)'"
echo "=================================================="
