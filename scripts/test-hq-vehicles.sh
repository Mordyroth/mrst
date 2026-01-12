#!/bin/bash
# Test HQ API vehicles endpoint

TENANT="A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW"
USER="jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO"
AUTH=$(echo -n "${TENANT}:${USER}" | base64)
BASE="https://api-america-3.caagcrm.com/api-america-3"

echo "=== Testing HQ API Endpoints ==="
echo ""

echo "1. Testing /car-rental/vehicles..."
curl -v -H "Authorization: Basic ${AUTH}" -H "Accept: application/json" "${BASE}/car-rental/vehicles?per_page=5" 2>&1 | head -100
echo ""
echo ""

echo "2. Testing /car-rental/fleet..."
curl -s -H "Authorization: Basic ${AUTH}" -H "Accept: application/json" "${BASE}/car-rental/fleet?per_page=5" | head -500
echo ""
echo ""

echo "3. Testing /customers..."
curl -s -H "Authorization: Basic ${AUTH}" -H "Accept: application/json" "${BASE}/customers?per_page=5" | head -500
echo ""
echo ""

echo "4. Testing /contacts..."
curl -s -H "Authorization: Basic ${AUTH}" -H "Accept: application/json" "${BASE}/contacts?per_page=5" | head -500
echo ""
