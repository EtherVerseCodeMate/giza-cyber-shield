#!/bin/bash

# Quick fix script for the GitHub App Lambda stack issue

PROJECT_NAME="khepra-protocol"
AWS_REGION="us-east-1"

echo "🔧 Fixing GitHub App Lambda stack issue..."

# Force delete the stuck stack
echo "Deleting stuck GitHub App Lambda stack..."
aws cloudformation delete-stack \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION"

echo "⏳ Waiting for deletion to complete..."
aws cloudformation wait stack-delete-complete \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION"

echo "✅ Stack deleted successfully!"
echo "🚀 Now run: ./aws-deployment/deploy.sh"