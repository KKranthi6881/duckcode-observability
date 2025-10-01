#!/bin/bash

# Test backend analytics API with your actual user token
# Get your token from browser localStorage

echo "Testing Analytics API Endpoints"
echo "================================"
echo ""

# Check if TOKEN is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your auth token as argument"
    echo ""
    echo "Usage: ./test-backend-analytics.sh YOUR_TOKEN"
    echo ""
    echo "To get your token:"
    echo "1. Open http://localhost:5175 in browser"
    echo "2. Sign in"
    echo "3. Open browser console (Cmd+Option+I)"
    echo "4. Run: localStorage.getItem('token')"
    echo "5. Copy the token and run this script"
    exit 1
fi

TOKEN="$1"

echo "1️⃣ Testing dashboard summary..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/analytics/dashboard-summary \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Dashboard summary: SUCCESS"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Dashboard summary: FAILED (HTTP $HTTP_CODE)"
    echo "$BODY"
fi

echo ""
echo "2️⃣ Testing conversations list..."
RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:3001/api/analytics/conversations?limit=5" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Conversations: SUCCESS"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Conversations: FAILED (HTTP $HTTP_CODE)"
    echo "$BODY"
fi

echo ""
echo "3️⃣ Testing daily trends..."
RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:3001/api/analytics/daily-trends?days=7" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Daily trends: SUCCESS"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Daily trends: FAILED (HTTP $HTTP_CODE)"
    echo "$BODY"
fi

echo ""
echo "4️⃣ Testing model breakdown..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/analytics/model-breakdown \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Model breakdown: SUCCESS"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Model breakdown: FAILED (HTTP $HTTP_CODE)"
    echo "$BODY"
fi

echo ""
echo "================================"
echo "Test Complete"
