import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: false,
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/:path*`,
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
        ],
    },
};

export default nextConfig;
