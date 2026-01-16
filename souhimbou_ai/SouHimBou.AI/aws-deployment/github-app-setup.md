# GitHub App Setup Guide for KHEPRA Protocol

This guide walks you through creating and configuring a GitHub App for secure CI/CD integration with AWS CodePipeline.

## Why Use GitHub Apps?

GitHub Apps provide several advantages over Personal Access Tokens (PATs):

- **Enhanced Security**: Short-lived tokens with automatic rotation
- **Granular Permissions**: Fine-grained access control to specific repositories
- **Organization-wide Access**: Not tied to individual user accounts
- **Better Audit Trail**: Detailed logs and activity tracking
- **Scalability**: Can be installed across multiple repositories and organizations

## Step 1: Create a GitHub App

1. **Navigate to GitHub Settings**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "GitHub Apps" in the left sidebar
   - Click "New GitHub App"

2. **Configure Basic Information**
   ```
   GitHub App name: KHEPRA Protocol CI/CD
   Homepage URL: https://your-domain.com
   Description: CI/CD automation for KHEPRA Protocol security platform
   ```

3. **Set Webhook Configuration**
   ```
   Webhook URL: https://api.github.com/  (temporary, will be updated)
   Webhook secret: Generate a random secret (save this)
   ```

4. **Configure Permissions**

   **Repository permissions:**
   - Contents: Read
   - Metadata: Read
   - Pull requests: Read
   - Checks: Write
   - Actions: Read
   - Commit statuses: Write

   **Account permissions:**
   - Email addresses: Read (if needed for notifications)

5. **Set Event Subscriptions**
   - Check "Push"
   - Check "Pull request"
   - Check "Release"

6. **Installation Options**
   - Select "Only on this account" if for personal use
   - Select "Any account" if for organizational use

7. **Create the App**
   - Click "Create GitHub App"
   - **Important**: Save the App ID displayed on the next page

## Step 2: Generate and Download Private Key

1. **After app creation, scroll down to "Private keys" section**
2. **Click "Generate a private key"**
3. **Download the `.pem` file** - this contains your private key
4. **Store securely** - you'll need this content for AWS setup

## Step 3: Install the GitHub App

1. **Go to your app's page** (GitHub → Settings → Developer settings → GitHub Apps → Your App)
2. **Click "Install App" in the left sidebar**
3. **Select your account/organization**
4. **Choose repository access:**
   - Select "Only select repositories" and choose your KHEPRA Protocol repository
   - Or select "All repositories" if you want organization-wide access
5. **Click "Install"**
6. **Note the Installation ID** from the URL (e.g., `https://github.com/settings/installations/12345678` - the number is your Installation ID)

## Step 4: Gather Required Information

You'll need these three pieces of information for AWS setup:

1. **App ID**: Found on your GitHub App's settings page
2. **Installation ID**: From the installation URL (step 3)
3. **Private Key**: Content of the downloaded `.pem` file

## Step 5: Run AWS Setup Script

1. **Navigate to your project directory:**
   ```bash
   cd aws-deployment
   ```

2. **Make the setup script executable:**
   ```bash
   chmod +x setup-github-app.sh
   ```

3. **Run the setup script:**
   ```bash
   ./setup-github-app.sh
   ```

4. **Provide the required information when prompted:**
   - App ID
   - Installation ID
   - Private Key (paste the entire content including headers)

## Step 6: Deploy Infrastructure

After setup is complete, deploy your infrastructure:

```bash
./deploy.sh
```

The deployment will now use GitHub App authentication instead of personal access tokens.

## Security Best Practices

### GitHub App Security
- **Review permissions regularly** - only grant necessary permissions
- **Monitor app installations** - track which repositories have access
- **Rotate keys periodically** - generate new private keys as needed
- **Use organization accounts** - avoid personal accounts for production

### AWS Security
- **GitHub App credentials are encrypted** in AWS Secrets Manager
- **Lambda generates short-lived tokens** (1 hour expiration)
- **IAM roles follow least privilege** principle
- **CloudTrail logs all API calls** for audit purposes

### Network Security
- **GitHub webhooks use HTTPS** with signature verification
- **AWS resources in private subnets** where possible
- **Security groups restrict access** to necessary ports only

## Troubleshooting

### Common Issues

**"Bad credentials" error:**
- Verify App ID and Installation ID are correct
- Ensure private key is complete and properly formatted
- Check that the app is installed on the correct repository

**"App not found" error:**
- Confirm the App ID matches your GitHub App
- Verify the app hasn't been deleted or suspended

**"Installation not found" error:**
- Check the Installation ID from the GitHub installation URL
- Ensure the app is installed on the target repository

**Lambda timeout errors:**
- Check CloudWatch logs for the token generation Lambda
- Verify Secrets Manager permissions are correct
- Ensure the private key format is valid

### Verification Steps

1. **Test token generation manually:**
   ```bash
   aws lambda invoke --function-name khepra-protocol-github-app-token-generator \
     --payload '{}' /tmp/response.json && cat /tmp/response.json
   ```

2. **Check secrets in AWS:**
   ```bash
   aws secretsmanager describe-secret --secret-id khepra-protocol-github-app-credentials
   ```

3. **Verify GitHub App installation:**
   - Visit your repository settings → Integrations → GitHub Apps
   - Confirm your app is listed and active

## Webhook Configuration (Optional)

For advanced CI/CD workflows, you can configure webhooks:

1. **Update your GitHub App webhook URL** to point to your AWS infrastructure
2. **Create API Gateway endpoint** to receive GitHub webhooks
3. **Process webhook events** in Lambda functions
4. **Trigger deployments** based on specific events

## Next Steps

After successful setup:

1. **Monitor deployments** in AWS CodePipeline console
2. **Review CloudWatch logs** for any issues
3. **Set up notifications** for build failures
4. **Configure additional branches** for staging environments
5. **Implement blue-green deployments** for zero-downtime updates

## Support

For issues with this setup:

1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Verify GitHub App permissions and installation
4. Consult AWS documentation for CodePipeline and Lambda
5. Check GitHub's API documentation for Apps

---

**Security Note**: Never share your GitHub App private key or commit it to version control. Always use secure credential management systems like AWS Secrets Manager.