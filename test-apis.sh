#!/bin/bash

# API Testing Script for Smart Gate Backend
# Make sure the backend is running on http://localhost:5050

BASE_URL="http://localhost:5050"
PHONE_NUMBER="9999999999"
OTP=""
TOKEN=""
USER_ID=""

echo "=========================================="
echo "Smart Gate API Testing"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Test 1: Send OTP
echo "1. Testing Send OTP..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/send-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phoneNumber\": \"$PHONE_NUMBER\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
    print_result 0 "Send OTP - Status: $HTTP_CODE"
    echo "   Response: $BODY"
    # Extract OTP from console (you'll need to check backend logs)
    echo -e "${YELLOW}   Note: Check backend console for OTP${NC}"
else
    print_result 1 "Send OTP - Status: $HTTP_CODE"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Verify OTP (using default OTP for test number)
echo "2. Testing Verify OTP..."
if [ "$PHONE_NUMBER" = "9999999999" ]; then
    OTP="123456"
    echo -e "${YELLOW}   Using default OTP: 123456${NC}"
else
    echo -e "${YELLOW}   Please enter the OTP from backend console:${NC}"
    read -p "   Enter OTP: " OTP
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/verify-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phoneNumber\": \"$PHONE_NUMBER\", \"otp\": \"$OTP\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
    print_result 0 "Verify OTP - Status: $HTTP_CODE"
    TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "   Token extracted: ${TOKEN:0:20}..."
    echo "   User ID: $USER_ID"
else
    print_result 1 "Verify OTP - Status: $HTTP_CODE"
    echo "   Response: $BODY"
    echo -e "${RED}   Cannot proceed without authentication token${NC}"
    exit 1
fi
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: Could not extract token. Exiting.${NC}"
    exit 1
fi

# Test 3: Get User Profile
echo "3. Testing Get User Profile..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/users/profile" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Profile - Status: $HTTP_CODE"
echo "   Response: $(echo "$BODY" | head -c 200)..."
echo ""

# Test 4: Update User Profile
echo "4. Testing Update User Profile..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/profile" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "fullName": "Test User",
        "email": "test@example.com",
        "role": "Owner",
        "block": "A",
        "flat": "101"
    }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Update Profile - Status: $HTTP_CODE"
echo ""

# Test 5: Create Staff
echo "5. Testing Create Staff..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/staff" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "John Doe",
        "role": "Driver",
        "phoneNumber": "9876543210"
    }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Staff - Status: $HTTP_CODE"
STAFF_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "   Staff ID: $STAFF_ID"
echo ""

# Test 6: Get Staff List
echo "6. Testing Get Staff List..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/staff" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Staff - Status: $HTTP_CODE"
echo ""

# Test 7: Staff Check-in (if staff exists)
if [ ! -z "$STAFF_ID" ]; then
    echo "7. Testing Staff Check-in..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/staff/$STAFF_ID/check-in" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result $([ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Staff Check-in - Status: $HTTP_CODE"
    echo ""
fi

# Test 8: Get Staff Activity
if [ ! -z "$STAFF_ID" ]; then
    echo "8. Testing Get Staff Activity..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/staff/$STAFF_ID/activity" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Staff Activity - Status: $HTTP_CODE"
    echo ""
fi

# Test 9: Get My Parking Slots
echo "9. Testing Get My Parking Slots..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/parking/my-slots" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get My Slots - Status: $HTTP_CODE"
echo ""

# Test 10: Apply for Parking
echo "10. Testing Apply for Parking..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/parking/apply" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "description": "Permanent Sticker Request",
        "parkingType": "Permanent",
        "vehicle": "Mercedes Benz S-Class",
        "licensePlate": "MH 43 SA 1139",
        "block": "A"
    }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Apply Parking - Status: $HTTP_CODE"
echo ""

# Test 11: Get Parking Applications
echo "11. Testing Get Parking Applications..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/parking/applications" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Applications - Status: $HTTP_CODE"
echo ""

# Test 12: Get Current Maintenance Dues
echo "12. Testing Get Current Maintenance Dues..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/maintenance/current-dues" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Current Dues - Status: $HTTP_CODE"
echo ""

# Test 13: Get Payment History
echo "13. Testing Get Payment History..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/maintenance/payment-history" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Payment History - Status: $HTTP_CODE"
echo ""

# Test 14: Get Total Amount Due
echo "14. Testing Get Total Amount Due..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/maintenance/total-due" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Total Due - Status: $HTTP_CODE"
echo "   Response: $BODY"
echo ""

# Test 15: Create Visitor
echo "15. Testing Create Visitor..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/visitors" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Visitor",
        "type": "Guest",
        "phoneNumber": "9876543210",
        "isPreApproved": false
    }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Visitor - Status: $HTTP_CODE"
VISITOR_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "   Visitor ID: $VISITOR_ID"
echo ""

# Test 16: Get Visitors
echo "16. Testing Get Visitors..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/visitors" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Visitors - Status: $HTTP_CODE"
echo ""

# Test 17: Get Today's Visitors
echo "17. Testing Get Today'\''s Visitors..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/visitors/today" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "Get Today Visitors - Status: $HTTP_CODE"
echo ""

echo "=========================================="
echo "API Testing Complete!"
echo "=========================================="
