import type { NextConfig } from 'next';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8000';

// Security headers (GĐ11). HSTS is deliberately absent: it belongs to whatever terminates HTTPS (see DOCKER.md).
// The CSP is production-only because `next dev` needs eval and a websocket. 'unsafe-inline' for scripts stays because
// Next.js streams inline hydration scripts and the theme is applied by a tiny inline script before first paint.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }] : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // The printable book is built on demand and can take a while for a big family.
  experimental: { proxyTimeout: 300_000 },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
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
