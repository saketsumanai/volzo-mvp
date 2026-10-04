#!/bin/bash

# Test Ride API Endpoint
# Usage: ./test-ride-api.sh <RIDE_ID> <AUTH_TOKEN>

RIDE_ID="${1:-2009a868-cc68-4fbf-b172-bad53cd6a201}"
AUTH_TOKEN="${2}"
BASE_URL="http://localhost:3000"

echo "🧪 Testing Ride API for Ride ID: $RIDE_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Get Ride Details
echo "📋 Test 1: GET /drivers/rides/$RIDE_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$AUTH_TOKEN" ]; then
  echo "⚠️  No auth token provided. Testing without authentication..."
  curl -X GET "$BASE_URL/drivers/rides/$RIDE_ID" \
    -H "Content-Type: application/json" \
    -w "\n\nHTTP Status: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || curl -X GET "$BASE_URL/drivers/rides/$RIDE_ID" -H "Content-Type: application/json" -w "\n\nHTTP Status: %{http_code}\n" -s
else
  curl -X GET "$BASE_URL/drivers/rides/$RIDE_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -w "\n\nHTTP Status: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || curl -X GET "$BASE_URL/drivers/rides/$RIDE_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH_TOKEN" -w "\n\nHTTP Status: %{http_code}\n" -s
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2: Check if rider object exists
echo "🔍 Test 2: Checking for rider object..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$AUTH_TOKEN" ]; then
  RESPONSE=$(curl -X GET "$BASE_URL/drivers/rides/$RIDE_ID" -H "Content-Type: application/json" -s)
else
  RESPONSE=$(curl -X GET "$BASE_URL/drivers/rides/$RIDE_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH_TOKEN" -s)
fi

# Check if jq is available
if command -v jq &> /dev/null; then
  echo "$RESPONSE" | jq '.data.ride.rider // "❌ Rider object missing!"'
  echo ""
  echo "Rider Name: $(echo "$RESPONSE" | jq -r '.data.ride.rider.name // "NOT FOUND"')"
  echo "Rider Phone: $(echo "$RESPONSE" | jq -r '.data.ride.rider.phoneNumber // .data.ride.rider.phone // "NOT FOUND"')"
  echo "Pickup Address: $(echo "$RESPONSE" | jq -r '.data.ride.pickupAddress // "NOT FOUND"')"
  echo "Drop Address: $(echo "$RESPONSE" | jq -r '.data.ride.dropAddress // "NOT FOUND"')"
  echo "Fare: $(echo "$RESPONSE" | jq -r '.data.ride.fare // .data.ride.estimatedFare // "NOT FOUND"')"
  echo "OTP: $(echo "$RESPONSE" | jq -r '.data.ride.otp // "NOT FOUND"')"
  echo "Status: $(echo "$RESPONSE" | jq -r '.data.ride.status // "NOT FOUND"')"
else
  echo "⚠️  jq not installed. Install with: brew install jq"
  echo "Raw response:"
  echo "$RESPONSE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: Accept Ride (if status is REQUESTED)
echo "📝 Test 3: Accept Ride (POST /drivers/rides/$RIDE_ID/accept)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$AUTH_TOKEN" ]; then
  echo "⚠️  Cannot test accept without auth token"
else
  echo "Testing accept endpoint..."
  curl -X POST "$BASE_URL/drivers/rides/$RIDE_ID/accept" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -w "\n\nHTTP Status: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || curl -X POST "$BASE_URL/drivers/rides/$RIDE_ID/accept" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH_TOKEN" -w "\n\nHTTP Status: %{http_code}\n" -s
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Testing complete!"
echo ""
echo "💡 Tips:"
echo "   - If rider object is missing, restart backend server"
echo "   - If HTTP 401, provide auth token: ./test-ride-api.sh <RIDE_ID> <TOKEN>"
echo "   - If HTTP 404, ride doesn't exist in database"
echo "   - Check backend logs for detailed error messages"
echo ""
