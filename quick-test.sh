#!/bin/bash

# Quick API Test Script
BASE_URL="http://localhost:5050"
PHONE="9999999999"

echo "=========================================="
echo "Quick API Test - Smart Gate Backend"
echo "=========================================="
echo ""

# Test 1: Send OTP
echo "1. Testing Send OTP..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\": \"$PHONE\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
  echo "✓ Send OTP - Status: $HTTP_CODE"
  echo "  Response: $BODY"
  echo ""
  echo "  ⚠️  Check backend console for OTP code!"
  echo ""
  echo "  To test verify-otp, run:"
  echo "  curl -X POST $BASE_URL/auth/verify-otp \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"phoneNumber\": \"$PHONE\", \"otp\": \"<OTP_FROM_CONSOLE>\"}'"
else
  echo "✗ Send OTP - Status: $HTTP_CODE"
  echo "  Response: $BODY"
fi

echo ""
echo "=========================================="
echo "For full testing:"
echo "1. Run: node test-apis-automated.js"
echo "2. Or see: test-endpoints.md for manual testing"
echo "=========================================="
