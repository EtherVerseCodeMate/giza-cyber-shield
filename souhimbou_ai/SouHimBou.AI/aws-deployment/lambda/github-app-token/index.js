const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const jwt = require('jsonwebtoken');
const https = require('https');

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Lambda function to generate GitHub App installation access tokens
 * This function exchanges GitHub App credentials for short-lived installation tokens
 */
exports.handler = async (event) => {
    try {
        console.log('Generating GitHub App installation token...');
        
        // Get GitHub App credentials from Secrets Manager
        const secretName = process.env.GITHUB_APP_SECRET_NAME;
        const getSecretCommand = new GetSecretValueCommand({ SecretId: secretName });
        const secretResponse = await secretsManager.send(getSecretCommand);
        const secrets = JSON.parse(secretResponse.SecretString);
        
        const { appId, installationId, privateKey } = secrets;
        
        // Generate JWT token for GitHub App authentication
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iat: now - 60, // Issued 60 seconds in the past to allow for clock drift
            exp: now + 600, // Expires in 10 minutes
            iss: appId
        };
        
        const jwtToken = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
        
        // Exchange JWT for installation access token
        const accessToken = await getInstallationAccessToken(jwtToken, installationId);
        
        console.log('Successfully generated installation access token');
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                token: accessToken,
                expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
            })
        };
        
    } catch (error) {
        console.error('Error generating GitHub App token:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to generate GitHub App token',
                message: error.message
            })
        };
    }
};

/**
 * Get installation access token from GitHub API
 */
function getInstallationAccessToken(jwtToken, installationId) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({});
        
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: `/app/installations/${installationId}/access_tokens`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'KHEPRA-Protocol-CI-CD',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const response = JSON.parse(data);
                    resolve(response.token);
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}