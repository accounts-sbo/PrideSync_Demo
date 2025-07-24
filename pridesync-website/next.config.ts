import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://pridesyncDemo-production.up.railway.app',
  },
  async rewrites() {
    return [
      {
        source: '/2025/:path*',
        destination: '/viewer/:path*',
      },
      {
        source: '/skipper/:path*',
        destination: '/skipper/:path*',
      },
    ];
  },
};

export default nextConfig;
