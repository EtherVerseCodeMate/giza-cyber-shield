// Use AGENT_URL from environment or fallback to production API
const AGENT_URL = process.env.AGENT_URL || process.env.NEXT_PUBLIC_API_URL || 'https://souhimbou-ai.fly.dev';

const isProd = process.env.NODE_ENV === 'production';

// Derive origin of the agent for connect-src
let agentOrigin = '';
try { agentOrigin = new URL(AGENT_URL).origin; } catch {}

const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    [
        "connect-src 'self'",
        'https://xjknkjbrjgljuovaazeu.supabase.co',
        'wss://xjknkjbrjgljuovaazeu.supabase.co',
        'https://api.x.ai',
        agentOrigin,
        isProd ? '' : 'http://localhost:45444 ws://localhost:45444',
    ].filter(Boolean).join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${isProd ? "'none'" : "'self'"}`,
    ...(isProd ? ["upgrade-insecure-requests"] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone', // Required for Docker deployment
    typescript: {
        ignoreBuildErrors: true, // Type errors checked in CI; don't block prod build
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Content-Security-Policy', value: csp },
                    { key: 'X-Frame-Options', value: isProd ? 'DENY' : 'SAMEORIGIN' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                ],
            },
        ];
    },
    async rewrites() {
        return [
            {
                source: '/api/v1/:path*',
                destination: `${AGENT_URL}/api/v1/:path*`,
            },
            {
                source: '/api/agent/:path*',
                destination: `${AGENT_URL}/:path*`,
            },
        ];
    },
};

export default nextConfig;
