#!/bin/bash

# SouHimBou AI Security Platform - Simplified AWS Deployment Script
set -e

# Configuration
PROJECT_NAME="khepra-protocol"
GITHUB_OWNER="EtherVerseCodeMate"
GITHUB_REPO="SouHimBou.AI"
DOMAIN_NAME="your-domain.com"
AWS_REGION="us-east-1"

echo "🚀 Starting SouHimBou AI Security Platform deployment..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured correctly"

# Debug: Show current directory and list files
echo "📁 Current working directory: $(pwd)"
echo "📁 Looking for CloudFormation templates..."

if [ -f "aws-deployment/cloudformation/main-infrastructure-new.yaml" ]; then
    echo "✅ Found main infrastructure template"
else
    echo "❌ main-infrastructure-new.yaml not found"
    ls -la aws-deployment/cloudformation/
    exit 1
fi

# Deploy infrastructure stack
echo "📦 Deploying infrastructure stack..."
aws cloudformation deploy \
    --template-file "aws-deployment/cloudformation/main-infrastructure-new.yaml" \
    --stack-name "${PROJECT_NAME}-infrastructure" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        GitHubOwner="$GITHUB_OWNER" \
        GitHubRepo="$GITHUB_REPO" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

if [ $? -eq 0 ]; then
    echo "✅ Infrastructure stack deployed successfully"
else
    echo "❌ Infrastructure stack deployment failed"
    exit 1
fi

echo "🎉 Basic infrastructure deployment complete!"
echo ""
echo "📊 Deployment Summary:"
echo "- Project: $PROJECT_NAME"
echo "- Environment: production"
echo "- Region: $AWS_REGION"
echo "- GitHub: $GITHUB_OWNER/$GITHUB_REPO"
echo ""
echo "Next: Complete remaining stacks (GitHub App Lambda, CI/CD Pipeline, ECS Application)"