#!/bin/bash
curl -s -X POST http://localhost:45444/api/v1/onboarding/scan \
  -H 'Content-Type: application/json' \
  -d '{"target_url":"nouchix.com","scan_type":"eval"}' && echo ""
