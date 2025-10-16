#!/bin/bash

# DuckCode Enterprise Security - Comprehensive Test Suite
# Tests all security features to ensure proper implementation

set -e

BASE_URL="http://localhost:3001"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

echo "================================================"
echo "DuckCode Enterprise Security Test Suite"
echo "================================================"
echo ""

# Helper function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=$3
    
    echo -e "${BLUE}Testing:${NC} $test_name"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Test 1: Rate Limiting
echo "================================================"
echo "Test Suite 1: Rate Limiting"
echo "================================================"
echo ""

echo "Test 1.1: Login rate limiting (should block after 5 attempts)"
BLOCKED=false
for i in {1..7}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"wrongpassword"}')
    
    echo "  Attempt $i: HTTP $STATUS"
    
    if [ "$i" -gt 5 ] && [ "$STATUS" -eq 429 ]; then
        BLOCKED=true
    fi
    sleep 0.5
done

if [ "$BLOCKED" = true ]; then
    echo -e "${GREEN}✓ PASS${NC}: Rate limiting working"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Rate limiting not working"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Password Policy
echo "================================================"
echo "Test Suite 2: Password Policy"
echo "================================================"
echo ""

echo "Test 2.1: Weak password should be rejected"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test1@test.com","password":"weak","fullName":"Test User"}')

if echo "$RESPONSE" | grep -q "Password must be at least"; then
    echo -e "${GREEN}✓ PASS${NC}: Weak password rejected"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Weak password not rejected"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 2.2: Strong password should be accepted"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$(date +%s)@test.com\",\"password\":\"SecureP@ssw0rd123\",\"fullName\":\"Test User\"}")

if echo "$RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✓ PASS${NC}: Strong password accepted"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Strong password not accepted"
    echo "Response: $RESPONSE"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Account Lockout
echo "================================================"
echo "Test Suite 3: Account Lockout"
echo "================================================"
echo ""

echo "Test 3.1: Account should lock after 5 failed attempts"
TEST_EMAIL="lockout$(date +%s)@test.com"

# First register the user
curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"SecureP@ssw0rd123\",\"fullName\":\"Test User\"}" > /dev/null

# Try 6 failed logins
LOCKED=false
for i in {1..6}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpassword\"}")
    
    echo "  Attempt $i: HTTP $STATUS"
    
    if [ "$STATUS" -eq 423 ]; then
        LOCKED=true
        break
    fi
    sleep 0.5
done

if [ "$LOCKED" = true ]; then
    echo -e "${GREEN}✓ PASS${NC}: Account lockout working"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Account lockout not working"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Security Audit Logging
echo "================================================"
echo "Test Suite 4: Security Audit Logging"
echo "================================================"
echo ""

echo "Test 4.1: Checking if audit log table exists"
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
    TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'duckcode' AND table_name = 'security_audit_log');")
    
    if echo "$TABLE_EXISTS" | grep -q "t"; then
        echo -e "${GREEN}✓ PASS${NC}: Audit log table exists"
        ((TESTS_PASSED++))
        
        # Check for recent events
        EVENT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM duckcode.security_audit_log WHERE created_at > NOW() - INTERVAL '1 hour';")
        echo "  Recent events (last hour): $EVENT_COUNT"
    else
        echo -e "${RED}✗ FAIL${NC}: Audit log table not found"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC}: psql or DATABASE_URL not available"
fi
echo ""

# Test 5: Session Management
echo "================================================"
echo "Test Suite 5: Session Management"
echo "================================================"
echo ""

echo "Test 5.1: IDE session creation"
# This would require a full OAuth flow, so we'll just check the endpoint exists
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/ide/token" \
    -H "Content-Type: application/json" \
    -d '{"code":"invalid","state":"test","redirect_uri":"vscode://test"}')

if [ "$STATUS" -eq 400 ]; then
    echo -e "${GREEN}✓ PASS${NC}: IDE token endpoint exists and validates input"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: IDE token endpoint not responding correctly"
    ((TESTS_FAILED++))
fi
echo ""

# Test 6: CSRF Protection
echo "================================================"
echo "Test Suite 6: CSRF Protection"
echo "================================================"
echo ""

echo "Test 6.1: State parameter validation"
# The endpoint should reject requests with mismatched state
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/ide/token" \
    -H "Content-Type: application/json" \
    -d '{"code":"test","state":"","redirect_uri":"vscode://test"}')

if [ "$STATUS" -eq 400 ]; then
    echo -e "${GREEN}✓ PASS${NC}: CSRF protection active (state validation)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: CSRF protection not working"
    ((TESTS_FAILED++))
fi
echo ""

# Test 7: Input Validation
echo "================================================"
echo "Test Suite 7: Input Validation"
echo "================================================"
echo ""

echo "Test 7.1: Email validation"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid-email","password":"test"}')

if [ "$STATUS" -eq 400 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Email validation working"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Email validation not working"
    ((TESTS_FAILED++))
fi
echo ""

echo "Test 7.2: Required fields validation"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com"}')

if [ "$STATUS" -eq 400 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Required fields validation working"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Required fields validation not working"
    ((TESTS_FAILED++))
fi
echo ""

# Test 8: Security Headers
echo "================================================"
echo "Test Suite 8: Security Headers"
echo "================================================"
echo ""

echo "Test 8.1: Helmet security headers"
HEADERS=$(curl -s -I "$BASE_URL/api/health")

if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo -e "${GREEN}✓ PASS${NC}: Security headers present"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Security headers missing"
    ((TESTS_FAILED++))
fi
echo ""

# Test 9: CORS Configuration
echo "================================================"
echo "Test Suite 9: CORS Configuration"
echo "================================================"
echo ""

echo "Test 9.1: CORS headers"
CORS_HEADER=$(curl -s -I "$BASE_URL/api/health" | grep -i "access-control-allow-origin")

if [ -n "$CORS_HEADER" ]; then
    echo -e "${GREEN}✓ PASS${NC}: CORS configured"
    echo "  $CORS_HEADER"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC}: CORS headers not found"
    ((TESTS_FAILED++))
fi
echo ""

# Final Summary
echo "================================================"
echo "Test Results Summary"
echo "================================================"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Security features are working correctly.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
