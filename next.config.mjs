const AGENT_URL = process.env.AGENT_URL || process.env.NEXT_PUBLIC_API_URL || 'https://souhimbou-ai.fly.dev';
const ASAF_LOCAL = process.env.ASAF_LOCAL_URL || 'http://localhost:45444';
const isDev = process.env.NODE_ENV === 'development';

// Supabase and external origins allowed in both environments
const SUPABASE_ORIGIN = 'https://xjknkjbrjgljuovaazeu.supabase.co';
const SUPABASE_WS    = 'wss://xjknkjbrjgljuovaazeu.supabase.co';
const XAI_ORIGIN     = 'https://api.x.ai';
const ASAF_ORIGIN    = 'https://souhimbou-ai.fly.dev';

const connectSrc = [
  "'self'",
  SUPABASE_ORIGIN,
  SUPABASE_WS,
  XAI_ORIGIN,
  ASAF_ORIGIN,
  // Allow local ASAF agent and Next.js hot-reload socket in dev
  ...(isDev ? [ASAF_LOCAL, 'ws://localhost:*', 'http://localhost:*'] : []),
].join(' ');

const csp = [
  `default-src 'self' ${SUPABASE_ORIGIN} ${XAI_ORIGIN}`,
  // unsafe-eval needed by Next.js Turbopack in dev; unsafe-inline needed for inline event handlers
  `script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : "'unsafe-inline'"} ${SUPABASE_ORIGIN}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `img-src 'self' data: https: blob:`,
  `connect-src ${connectSrc}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  // frame-ancestors MUST be an HTTP header — ignored in <meta>
  `frame-ancestors ${isDev ? "'self'" : "'none'"}`,
  ...(!isDev ? ["report-uri /csp-report"] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Content-Security-Policy',   value: csp },
                    // X-Frame-Options must be an HTTP header — ignored in <meta>
                    { key: 'X-Frame-Options',           value: isDev ? 'SAMEORIGIN' : 'DENY' },
                    { key: 'X-Content-Type-Options',    value: 'nosniff' },
                    { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
                    ...(!isDev ? [
                        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
                        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                        { key: 'Cross-Origin-Opener-Policy',  value: 'same-origin' },
                    ] : []),
                ],
            },
        ];
    },

    async rewrites() {
        return [
            // Proxy legacy /api/agent/* path to ASAF agent
            {
                source: '/api/agent/:path*',
                destination: `${AGENT_URL}/:path*`,
            },
            // In dev, proxy /api/v1/* to the local ASAF agent (avoids CSP issues)
            ...(isDev ? [{
                source: '/api/v1/:path*',
                destination: `${ASAF_LOCAL}/api/v1/:path*`,
            }] : []),
        ];
    },
};

export default nextConfig;
