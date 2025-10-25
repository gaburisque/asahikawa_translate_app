/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public assets without content hash
        source: '/:all*(png|jpg|jpeg|gif|svg|webp|ico|json|txt|webmanifest|mp3|wav)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        // API responses should not be cached
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // HTML pages: SWR
        source: '/((?!_next|api|.*\\.).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=0, stale-while-revalidate=60' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

