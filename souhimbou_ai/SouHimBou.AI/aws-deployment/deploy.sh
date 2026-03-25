#!/bin/bash

# KHEPRA Protocol - AWS Deployment Script with GitHub App Integration
# This script deploys the complete infrastructure using CloudFormation

set -e

# Configuration
PROJECT_NAME="khepra-protocol"
GITHUB_OWNER="EtherVerseCodeMate"
GITHUB_REPO="SouHimBou.AI"
DOMAIN_NAME="https://souhimbou.ai"
AWS_REGION="us-east-1"               # Change if needed

echo "🚀 Starting SouHimBou AI Security Platform deployment..."

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if GitHub App is configured
if [ ! -f "aws-deployment/.github-app-env" ]; then
    echo "❌ GitHub App not configured. Please run './setup-github-app.sh' first."
    exit 1
fi

# Load GitHub App configuration
source aws-deployment/.github-app-env

echo "✅ AWS CLI configured correctly"
echo "✅ GitHub App configured"

# Deploy from root directory with proper paths

# Function to wait for stack completion
wait_for_stack() {
    local stack_name=$1
    local operation=$2
    
    echo "⏳ Waiting for stack $stack_name to $operation..."
    
    aws cloudformation wait stack-${operation}-complete \
        --stack-name "$stack_name" \
        --region "$AWS_REGION"
    
    if [ $? -eq 0 ]; then
        echo "✅ Stack $stack_name ${operation}d successfully"
    else
        echo "❌ Stack $stack_name $operation failed"
        exit 1
    fi
}

# Deploy infrastructure stack
echo "📦 Deploying infrastructure stack..."
aws cloudformation deploy \
    --template-file aws-deployment/cloudformation/main-infrastructure-new.yaml \
    --stack-name "${PROJECT_NAME}-infrastructure" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        GitHubOwner="$GITHUB_OWNER" \
        GitHubRepo="$GITHUB_REPO" \
        GitHubToken="dummy-token" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

wait_for_stack "${PROJECT_NAME}-infrastructure" "create"

# Deploy GitHub App Lambda function - Force clean deployment
echo "🔧 Deploying GitHub App token generator..."

# Force delete any existing stack first to ensure clean deployment
echo "🧹 Cleaning up any existing GitHub App Lambda stack..."
aws cloudformation delete-stack \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION" 2>/dev/null || echo "No existing stack to delete"

# Wait for deletion to complete (this will succeed even if stack doesn't exist)
echo "⏳ Waiting for any existing stack to be fully deleted..."
aws cloudformation wait stack-delete-complete \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --region "$AWS_REGION" 2>/dev/null || echo "Stack deletion wait completed"

echo "✅ Ready for fresh deployment"

# Now deploy the stack fresh
echo "🚀 Deploying GitHub App Lambda stack..."
aws cloudformation deploy \
    --template-file aws-deployment/cloudformation/github-app-lambda-simple.yaml \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        GitHubAppSecretName="$GITHUB_APP_SECRET_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

if [ $? -eq 0 ]; then
    echo "✅ GitHub App Lambda stack deployed successfully"
else
    echo "❌ GitHub App Lambda stack deployment failed"
    exit 1
fi

# Get Lambda function name for CI/CD pipeline
GITHUB_TOKEN_LAMBDA_NAME=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-github-app-lambda" \
    --query 'Stacks[0].Outputs[?OutputKey==`GitHubAppTokenLambdaName`].OutputValue' \
    --output text \
    --region "$AWS_REGION")

# Deploy CI/CD pipeline
echo "🔧 Deploying CI/CD pipeline..."
aws cloudformation deploy \
    --template-file aws-deployment/cloudformation/ci-cd-pipeline.yaml \
    --stack-name "${PROJECT_NAME}-pipeline" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        GitHubOwner="$GITHUB_OWNER" \
        GitHubRepo="$GITHUB_REPO" \
        GitHubAppSecretName="$GITHUB_APP_SECRET_NAME" \
        GitHubAppTokenLambdaName="$GITHUB_TOKEN_LAMBDA_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

wait_for_stack "${PROJECT_NAME}-pipeline" "create"

# Deploy ECS application
echo "🖥️  Deploying ECS application..."
aws cloudformation deploy \
    --template-file aws-deployment/cloudformation/ecs-application.yaml \
    --stack-name "${PROJECT_NAME}-application" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="production" \
        DomainName="$DOMAIN_NAME" \
    --capabilities CAPABILITY_IAM \
    --region "$AWS_REGION"

wait_for_stack "${PROJECT_NAME}-application" "create"

# Get outputs
echo "📋 Getting deployment information..."

ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-application" \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text \
    --region "$AWS_REGION")

PIPELINE_NAME=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-pipeline" \
    --query 'Stacks[0].Outputs[?OutputKey==`PipelineName`].OutputValue' \
    --output text \
    --region "$AWS_REGION")

ECR_URI=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-pipeline" \
    --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
    --output text \
    --region "$AWS_REGION")

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Deployment Information:"
echo "=========================="
echo "Application URL: http://$ALB_DNS"
echo "Pipeline Name: $PIPELINE_NAME"
echo "ECR Repository: $ECR_URI"
echo "AWS Region: $AWS_REGION"
echo ""
echo "🔗 Next Steps:"
echo "1. Push your code to GitHub repository: $GITHUB_OWNER/$GITHUB_REPO"
echo "2. The pipeline will automatically build and deploy your application"
echo "3. Set up your domain to point to: $ALB_DNS"
echo "4. Configure SSL certificate in AWS Certificate Manager"
echo ""
echo "🖥️  AWS Console Links:"
echo "- CodePipeline: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/$PIPELINE_NAME/view"
echo "- ECS Cluster: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters"
echo "- Load Balancer: https://console.aws.amazon.com/ec2/v2/home?region=$AWS_REGION#LoadBalancers:"
echo ""
echo "✅ SouHimBou AI Security Platform is ready for deployment!"