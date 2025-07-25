/** @type {import('next').NextConfig} */
const nextConfig = {
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
    BACKEND_URL: process.env.NODE_ENV === 'production'
      ? 'https://pridesyncdemo-production.up.railway.app'
      : 'http://localhost:3001',
  },
};

module.exports = nextConfig;
