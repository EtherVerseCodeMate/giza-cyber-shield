#!/bin/bash

# GitHub App Setup Script for KHEPRA Protocol AWS Deployment
# This script helps configure GitHub App credentials for secure CI/CD integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="khepra-protocol"
REGION="us-east-1"

echo -e "${BLUE}🔧 GitHub App Setup for KHEPRA Protocol${NC}"
echo "=========================================="

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"

# Get GitHub App details
echo ""
echo -e "${YELLOW}📋 Please provide your GitHub App details:${NC}"
echo "You can find these in your GitHub App settings at:"
echo "https://github.com/settings/apps/[your-app-name]"
echo ""

read -p "GitHub App ID: " GITHUB_APP_ID
read -p "GitHub App Installation ID: " GITHUB_INSTALLATION_ID
echo "GitHub App Private Key (paste the entire key including headers):"
echo "Press Ctrl+D when finished:"
GITHUB_PRIVATE_KEY=$(cat)

# Validate inputs
if [[ -z "$GITHUB_APP_ID" || -z "$GITHUB_INSTALLATION_ID" || -z "$GITHUB_PRIVATE_KEY" ]]; then
    echo -e "${RED}❌ All fields are required${NC}"
    exit 1
fi

# Store credentials in AWS Secrets Manager
echo ""
echo -e "${BLUE}🔐 Storing GitHub App credentials in AWS Secrets Manager...${NC}"

# Create the secret
SECRET_VALUE=$(cat <<EOF
{
  "appId": "$GITHUB_APP_ID",
  "installationId": "$GITHUB_INSTALLATION_ID",
  "privateKey": "$GITHUB_PRIVATE_KEY"
}
EOF
)

SECRET_NAME="${PROJECT_NAME}-github-app-credentials"

# Check if secret exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &> /dev/null; then
    echo "Secret already exists. Updating..."
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_VALUE" \
        --region "$REGION" > /dev/null
else
    echo "Creating new secret..."
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "GitHub App credentials for KHEPRA Protocol CI/CD" \
        --secret-string "$SECRET_VALUE" \
        --region "$REGION" > /dev/null
fi

echo -e "${GREEN}✅ GitHub App credentials stored securely${NC}"

# Create environment file for deployment
cat > aws-deployment/.github-app-env << EOF
GITHUB_APP_SECRET_NAME=${SECRET_NAME}
GITHUB_APP_ID=${GITHUB_APP_ID}
GITHUB_INSTALLATION_ID=${GITHUB_INSTALLATION_ID}
EOF

echo ""
echo -e "${GREEN}🎉 GitHub App setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run './deploy.sh' to deploy the infrastructure"
echo "2. The CI/CD pipeline will use GitHub App authentication"
echo "3. Your GitHub App credentials are securely stored in AWS Secrets Manager"
echo ""
echo -e "${BLUE}📝 Configuration saved to: aws-deployment/.github-app-env${NC}"