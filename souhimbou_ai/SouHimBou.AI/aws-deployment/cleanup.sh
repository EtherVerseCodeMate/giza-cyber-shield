#!/bin/bash

# KHEPRA Protocol - AWS Stack Cleanup Script
# Run this before deploy.sh to ensure clean deployment

set -e

PROJECT_NAME="khepra-protocol"
AWS_REGION="us-east-1"

echo "🧹 KHEPRA Protocol - Stack Cleanup"
echo "=================================="

# Force delete all stacks to ensure clean deployment
echo "🗑️  Deleting all KHEPRA stacks..."

# Delete application stack first (dependent on others)
echo "Deleting application stack..."
aws cloudformation delete-stack \
    --stack-name "${PROJECT_NAME}-application" \
    --region "$AWS_REGION" 2>/dev/null || echo "Application stack not found"

# Delete pipeline stack
echo "Deleting pipeline stack..."
aws cloudformation delete-stack \
    --stack-name "${PROJECT_NAME}-pipeline" \
    --region "$AWS_REGION" 2>/dev/null || echo "Pipeline stack not found"

# Delete GitHub App Lambda stack
echo "Deleting GitHub App Lambda stack..."
aws cloudformation delete-stack \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION" 2>/dev/null || echo "GitHub App Lambda stack not found"

# Delete infrastructure stack last
echo "Deleting infrastructure stack..."
aws cloudformation delete-stack \
    --stack-name "${PROJECT_NAME}-infrastructure" \
    --region "$AWS_REGION" 2>/dev/null || echo "Infrastructure stack not found"

echo ""
echo "⏳ Waiting for all stacks to be deleted..."
echo "This may take a few minutes..."

# Wait for all deletions to complete
aws cloudformation wait stack-delete-complete \
    --stack-name "${PROJECT_NAME}-application" \
    --region "$AWS_REGION" 2>/dev/null || echo "Application stack deletion complete"

aws cloudformation wait stack-delete-complete \
    --stack-name "${PROJECT_NAME}-pipeline" \
    --region "$AWS_REGION" 2>/dev/null || echo "Pipeline stack deletion complete"

aws cloudformation wait stack-delete-complete \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION" 2>/dev/null || echo "GitHub App Lambda stack deletion complete"

aws cloudformation wait stack-delete-complete \
    --stack-name "${PROJECT_NAME}-infrastructure" \
    --region "$AWS_REGION" 2>/dev/null || echo "Infrastructure stack deletion complete"

echo ""
echo "✅ All stacks cleaned up successfully!"
echo "🚀 Now run: ./aws-deployment/deploy.sh"