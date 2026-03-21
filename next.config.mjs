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
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default nextConfig;
