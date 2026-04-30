#!/usr/bin/env bash
# Test TAB beta API from an Australian IP
# Usage: bash scripts/test-tab-api.sh

set -euo pipefail

DATE="${1:-today}"
echo "Testing TAB API for date: $DATE"
echo "---"

# Test meetings endpoint (NSW)
echo "=== NSW Meetings ==="
curl -sL --connect-timeout 15 --max-time 30 \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  "https://api.beta.tab.com.au/v1/tab-info-service/racing/dates/${DATE}/meetings?jurisdiction=NSW&returnOffers=false" \
  2>/dev/null | python3 -m json.tool 2>/dev/null | head -100 || echo "FAILED"

echo ""
echo "=== VIC Meetings ==="
curl -sL --connect-timeout 15 --max-time 30 \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  "https://api.beta.tab.com.au/v1/tab-info-service/racing/dates/${DATE}/meetings?jurisdiction=VIC&returnOffers=false" \
  2>/dev/null | python3 -m json.tool 2>/dev/null | head -100 || echo "FAILED"

echo ""
echo "=== QLD Meetings ==="
curl -sL --connect-timeout 15 --max-time 30 \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  "https://api.beta.tab.com.au/v1/tab-info-service/racing/dates/${DATE}/meetings?jurisdiction=QLD&returnOffers=false" \
  2>/dev/null | python3 -m json.tool 2>/dev/null | head -100 || echo "FAILED"

echo ""
echo "=== All Jurisdictions (no filter) ==="
curl -sL --connect-timeout 15 --max-time 30 \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  "https://api.beta.tab.com.au/v1/tab-info-service/racing/dates/${DATE}/meetings?returnOffers=false" \
  2>/dev/null | python3 -m json.tool 2>/dev/null | head -200 || echo "FAILED"

echo ""
echo "=== Full Response (raw, first 5000 chars) ==="
curl -sL --connect-timeout 15 --max-time 30 \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  "https://api.beta.tab.com.au/v1/tab-info-service/racing/dates/${DATE}/meetings?jurisdiction=NSW&returnOffers=false" \
  2>/dev/null | head -c 5000

echo ""
echo "---"
echo "Save full output: bash scripts/test-tab-api.sh > /tmp/tab-api-response.json"
