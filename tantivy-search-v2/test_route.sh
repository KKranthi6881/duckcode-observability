#!/bin/bash
# Test if file routes actually work

echo "Testing metadata route (should work):"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3002/api/v2/search/query?q=test"

echo "Testing file test route (should be 200 but getting 404):"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3002/api/v2/search/files/test"

echo "Testing file index route (should work but getting 404):"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3002/api/v2/search/files/index" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"test","repository_id":"test","files":[]}'
