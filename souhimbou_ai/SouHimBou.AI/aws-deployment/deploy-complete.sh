#!/bin/bash

# SouHimBou AI Security Platform - Complete AWS Deployment Script
set -e

# Configuration
PROJECT_NAME="khepra-protocol"
GITHUB_OWNER="EtherVerseCodeMate"
GITHUB_REPO="SouHimBou.AI"
DOMAIN_NAME="your-domain.com"
AWS_REGION="us-east-1"

echo "🚀 Starting complete SouHimBou AI Security Platform deployment..."

# Check if we have GitHub App credentials
if [ ! -f "aws-deployment/.github-app-env" ]; then
    echo "⚠️  GitHub App credentials not found. Please run setup first:"
    echo "   ./aws-deployment/setup-github-app.sh"
    exit 1
fi

# Load GitHub App environment variables
source aws-deployment/.github-app-env

# Function to wait for stack completion
wait_for_stack() {
    local stack_name=$1
    local operation=$2
    
    echo "⏳ Waiting for $stack_name to complete ($operation)..."
    aws cloudformation wait stack-${operation}-complete --stack-name "$stack_name" --region "$AWS_REGION"
    
    if [ $? -eq 0 ]; then
        echo "✅ $stack_name completed successfully"
    else
        echo "❌ $stack_name failed"
        exit 1
    fi
}

# Update infrastructure stack with subnet exports
echo "📦 Updating infrastructure stack with subnet exports..."
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

wait_for_stack "${PROJECT_NAME}-infrastructure" "update"

# Deploy GitHub App Lambda
echo "📦 Deploying GitHub App Lambda..."
aws cloudformation deploy \
    --template-file "aws-deployment/cloudformation/github-app-lambda.yaml" \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        GitHubAppSecretName="$GITHUB_APP_SECRET_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

wait_for_stack "${PROJECT_NAME}-github-app-lambda" "create"

# Get Lambda function name from stack outputs
LAMBDA_FUNCTION_NAME=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`GitHubAppTokenLambdaName`].OutputValue' \
    --output text)

# Deploy CI/CD Pipeline
echo "📦 Deploying CI/CD Pipeline..."
aws cloudformation deploy \
    --template-file "aws-deployment/cloudformation/ci-cd-pipeline.yaml" \
    --stack-name "${PROJECT_NAME}-ci-cd" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        GitHubOwner="$GITHUB_OWNER" \
        GitHubRepo="$GITHUB_REPO" \
        GitHubAppSecretName="$GITHUB_APP_SECRET_NAME" \
        GitHubAppTokenLambdaName="$LAMBDA_FUNCTION_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

wait_for_stack "${PROJECT_NAME}-ci-cd" "create"

# Deploy ECS Application
echo "📦 Deploying ECS Application..."
aws cloudformation deploy \
    --template-file "aws-deployment/cloudformation/ecs-application.yaml" \
    --stack-name "${PROJECT_NAME}-ecs-app" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        DomainName="$DOMAIN_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

wait_for_stack "${PROJECT_NAME}-ecs-app" "create"

echo "🎉 Complete deployment finished!"
echo ""
echo "📊 Deployment Summary:"
echo "- Project: $PROJECT_NAME"
echo "- Environment: production"
echo "- Region: $AWS_REGION"
echo "- GitHub: $GITHUB_OWNER/$GITHUB_REPO"
echo ""
echo "🔗 Next Steps:"
echo "1. Your application will be available at the ALB DNS name"
echo "2. Set up your domain and SSL certificate"
echo "3. Push code changes to trigger the CI/CD pipeline"
echo ""
echo "📈 Access your resources:"
echo "- CloudFormation: https://console.aws.amazon.com/cloudformation/"
echo "- CodePipeline: https://console.aws.amazon.com/codesuite/codepipeline/"
echo "- ECS: https://console.aws.amazon.com/ecs/"
echo "- ALB: https://console.aws.amazon.com/ec2/v2/home#LoadBalancers:"