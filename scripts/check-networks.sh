#!/bin/bash
echo "=== NPM networks ==="
docker inspect nouchix-npm | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(list(d['NetworkSettings']['Networks'].keys()))"

echo "=== n8n networks ==="
docker inspect nouchix-n8n | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(list(d['NetworkSettings']['Networks'].keys()))"

echo "=== dashboard networks ==="
docker inspect asaf-dashboard | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(list(d['NetworkSettings']['Networks'].keys()))"
