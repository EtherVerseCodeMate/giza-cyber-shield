// Use AGENT_URL from environment or fallback to localhost for dev
const AGENT_URL = process.env.AGENT_URL || 'http://127.0.0.1:45444';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
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
