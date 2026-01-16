# SouHimBou AI Security Platform - AWS Deployment

This directory contains everything needed to deploy the complete SouHimBou AI Security Platform to AWS using Infrastructure as Code.

## 🏗️ Architecture Overview

- **Frontend**: React/Vite app running on ECS Fargate
- **Backend**: Supabase services and Lambda functions
- **Database**: RDS PostgreSQL Multi-AZ with encryption
- **Security**: WAF, Security Groups, KMS encryption
- **CI/CD**: CodePipeline with automated security scanning
- **Monitoring**: CloudWatch, GuardDuty, Security Hub

## 📋 Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **GitHub Repository** with your SouHimBou code (connected via Lovable)
4. **GitHub Personal Access Token** with repo permissions
5. **Domain name** (optional, for production)

## 🚀 Quick Deployment

### Step 1: Prepare Your Repository

First, connect your Lovable project to GitHub:

1. In Lovable, click **GitHub** → **Connect to GitHub**
2. Authorize the Lovable GitHub App
3. Create repository with your project code

### Step 2: Configure Deployment

Edit the variables in `deploy.sh`:

```bash
# Configuration
PROJECT_NAME="souhimbou-ai"
GITHUB_OWNER="your-github-username"    # Your GitHub username
GITHUB_REPO="your-repo-name"           # Your repository name  
GITHUB_TOKEN="your-github-token"       # GitHub personal access token
DOMAIN_NAME="souhimbou.ai"            # Your domain (optional)
AWS_REGION="us-east-1"                # AWS region
```

### Step 3: Deploy Infrastructure

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will deploy:
1. **Infrastructure Stack** (VPC, Security Groups, KMS)
2. **CI/CD Pipeline** (CodePipeline, CodeBuild, ECR)
3. **Application Stack** (ECS, ALB, Auto Scaling, WAF)

### Step 4: Verify Deployment

After deployment completes:

1. **Check Pipeline**: Go to AWS CodePipeline console
2. **Push Code**: Push your code to trigger first build
3. **Access Application**: Use the ALB DNS name provided
4. **Configure Domain**: Point your domain to the load balancer

## 📁 Directory Structure

```
aws-deployment/
├── cloudformation/
│   ├── main-infrastructure.yaml    # VPC, networking, security
│   ├── ci-cd-pipeline.yaml        # CodePipeline, CodeBuild, ECR
│   └── ecs-application.yaml       # ECS, ALB, WAF, auto-scaling
├── deploy.sh                      # Main deployment script
└── README.md                      # This file
```

## 🔧 Manual Deployment (Alternative)

If you prefer to deploy stacks individually:

```bash
# 1. Deploy infrastructure
aws cloudformation deploy \
    --template-file cloudformation/main-infrastructure.yaml \
    --stack-name souhimbou-ai-infrastructure \
    --parameter-overrides ProjectName=souhimbou-ai \
    --capabilities CAPABILITY_IAM

# 2. Deploy CI/CD pipeline  
aws cloudformation deploy \
    --template-file cloudformation/ci-cd-pipeline.yaml \
    --stack-name souhimbou-ai-pipeline \
    --parameter-overrides ProjectName=souhimbou-ai GitHubOwner=your-username GitHubRepo=your-repo GitHubToken=your-token \
    --capabilities CAPABILITY_IAM

# 3. Deploy application
aws cloudformation deploy \
    --template-file cloudformation/ecs-application.yaml \
    --stack-name souhimbou-ai-application \
    --parameter-overrides ProjectName=souhimbou-ai \
    --capabilities CAPABILITY_IAM
```

## 💰 Cost Estimation

**Monthly costs for production deployment:**

| Service | Cost Range | Description |
|---------|------------|-------------|
| ECS Fargate | $800-1,200 | Application hosting |
| RDS Multi-AZ | $400-600 | PostgreSQL database |
| ALB + CloudFront | $50-100 | Load balancing & CDN |
| WAF + Shield | $50-100 | Web application firewall |
| GuardDuty | $30-80 | Threat detection |
| CloudTrail | $20-50 | Audit logging |
| Other services | $40-100 | KMS, Secrets Manager, etc. |
| **Total** | **$1,390-2,230** | **Per month** |

**Cost optimization tips:**
- Use Reserved Instances for 30-50% savings
- Enable auto-scaling for variable workloads
- Use S3 Intelligent Tiering for backups
- Configure log retention policies

## 🔒 Security Features

### Network Security
- Multi-AZ VPC with private/public subnet isolation
- Security groups with least-privilege access
- VPC Flow Logs for traffic analysis
- Network ACLs for additional protection

### Application Security
- WAF with managed rule sets and rate limiting
- Container image vulnerability scanning
- Runtime security monitoring
- SSL/TLS encryption in transit

### Data Protection
- RDS encryption at rest with KMS
- Secrets Manager for credential storage
- S3 encryption for backups and artifacts
- CloudTrail for comprehensive audit logging

### Compliance
- FedRAMP compliance ready
- SOC 2 Type II controls
- DoD CMMC Level 2 & 3 support
- NIST Cybersecurity Framework alignment

## 🔍 Monitoring & Alerting

### Included Monitoring
- CloudWatch dashboards for application metrics
- GuardDuty for threat detection
- Security Hub for compliance monitoring
- ECS service health checks and auto-recovery

### Custom Alerts
- High CPU/memory utilization
- Database connection limits
- WAF blocked request spikes
- Failed deployment notifications

## 🛠️ Troubleshooting

### Common Issues

**1. Stack creation fails**
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name souhimbou-ai-infrastructure

# Check logs
aws logs describe-log-groups --log-group-name-prefix /aws/codebuild/
```

**2. Pipeline fails to start**
- Verify GitHub token has correct permissions
- Check if repository exists and is accessible
- Ensure branch name is correct (main vs master)

**3. ECS service fails to start**
- Check CloudWatch logs: `/ecs/souhimbou-ai`
- Verify task definition CPU/memory limits
- Check security group rules

**4. Application not accessible**
- Verify ALB target group health
- Check security group inbound rules
- Test ECS service connectivity

### Getting Help

1. **AWS Support**: Check AWS Support Center
2. **CloudWatch Logs**: Monitor application and infrastructure logs
3. **Stack Events**: Review CloudFormation events for errors
4. **Community**: SouHimBou Discord/GitHub discussions

## 🔄 Updates & Maintenance

### Automatic Updates
- Code changes in GitHub trigger automatic deployments
- Container images are automatically scanned for vulnerabilities
- Infrastructure changes via CloudFormation ensure consistency

### Manual Updates
```bash
# Update infrastructure
aws cloudformation deploy --template-file cloudformation/main-infrastructure.yaml --stack-name souhimbou-ai-infrastructure

# Update pipeline configuration  
aws cloudformation deploy --template-file cloudformation/ci-cd-pipeline.yaml --stack-name souhimbou-ai-pipeline

# Update application settings
aws cloudformation deploy --template-file cloudformation/ecs-application.yaml --stack-name souhimbou-ai-application
```

### Backup & Recovery
- Automated RDS backups with 30-day retention
- ECS task definitions versioned automatically
- Infrastructure templates in version control
- Point-in-time recovery for critical data

## 🎯 Production Readiness

### Before Going Live
- [ ] Run security penetration testing
- [ ] Validate all compliance requirements
- [ ] Configure custom domain and SSL
- [ ] Set up monitoring alerts
- [ ] Test disaster recovery procedures
- [ ] Review and optimize costs

### Post-Deployment
- [ ] Monitor application performance
- [ ] Review security findings regularly
- [ ] Update dependencies and container images
- [ ] Conduct regular compliance audits
- [ ] Optimize costs based on usage patterns

---

**Ready to deploy your SouHimBou AI Security Platform to AWS! 🚀**