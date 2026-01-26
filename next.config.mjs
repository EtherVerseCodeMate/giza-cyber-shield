// Use AGENT_URL from environment or fallback to production API
const AGENT_URL = process.env.AGENT_URL || process.env.NEXT_PUBLIC_API_URL || 'https://souhimbou-ai.fly.dev';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone', // Required for Docker deployment
    // Note: src/pages/ contains React Router views, not Next.js pages
    // App Router in src/app/ handles all routing
    async rewrites() {
        return [
            {
                source: '/api/agent/:path*',
                destination: `${AGENT_URL}/:path*`,
            },
        ];
    },
};

export default nextConfig;
