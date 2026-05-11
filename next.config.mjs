/** @type {import('next').NextConfig} */
const isPagesExport = process.env.PAGES_EXPORT === 'true';

const nextConfig = {
  ...(isPagesExport && {
    output: 'export',
    basePath: '/cryto-day-trading',
    images: { unoptimized: true },
  }),
  serverExternalPackages: [],
  experimental: {
    // Increase the fetch timeout for slow Binance API connections
    fetchCacheKeyPrefix: 'crypto-trader',
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.binance.com https://api.bybit.com https://api.bitget.com https://api.coingecko.com",
      "font-src 'self' data:",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default nextConfig;
