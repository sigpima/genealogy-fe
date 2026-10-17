import type { NextConfig } from 'next';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The printable book is built on demand and can take a while for a big family.
  experimental: { proxyTimeout: 300_000 },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE_URL}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${API_BASE_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
