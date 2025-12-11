/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/api/agent/:path*',
                destination: 'http://127.0.0.1:45444/:path*',
            },
        ];
    },
};

export default nextConfig;
