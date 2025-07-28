import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'https://pridesyncdemo-production.up.railway.app/api/:path*'
          : 'http://localhost:3001/api/:path*',
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://pridesyncdemo-production.up.railway.app',
    BACKEND_URL: process.env.NODE_ENV === 'production'
      ? 'https://pridesyncdemo-production.up.railway.app'
      : 'http://localhost:3000',
  },
};

export default nextConfig;
