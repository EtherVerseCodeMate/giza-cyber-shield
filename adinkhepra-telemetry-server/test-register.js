// Node.js HMAC test — same crypto as the browser WebCrypto API
const crypto = require('crypto');
const https = require('https');

const ENROLLMENT_TOKEN = 'khepra-enroll-cuminmall-test1234abcd';
const BASE_URL = 'telemetry.souhimbou.org';
const machineId = `e2e-node-${Date.now()}`;
const timestamp = Math.floor(Date.now() / 1000).toString();

const bodyObj = {
    machine_id: machineId,
    enrollment_token: ENROLLMENT_TOKEN,
    hostname: 'e2e-host',
    platform: 'windows',
    agent_version: '1.0.0'
};
const body = JSON.stringify(bodyObj);
const message = `${machineId}.${timestamp}.${body}`;

const hmac = crypto.createHmac('sha256', ENROLLMENT_TOKEN);
hmac.update(message, 'utf8');
const sig = hmac.digest('hex');

console.log('machineId:', machineId);
console.log('timestamp:', timestamp);
console.log('body:', body);
console.log('message:', message.substring(0, 100) + '...');
console.log('sig:', sig);
console.log('');

const options = {
    hostname: BASE_URL,
    path: '/license/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Khepra-Signature': sig,
        'X-Khepra-Timestamp': timestamp,
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', (e) => { console.error('Error:', e); });
req.write(body);
req.end();
