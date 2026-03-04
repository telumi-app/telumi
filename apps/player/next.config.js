/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@telumi/shared'],

  // ── Cache & CDN headers ────────────────────────────────────────────
  async headers() {
    return [
      // Static assets (JS/CSS/images/fonts) — long-lived immutable
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Player page — short SWR so device gets fresh manifests
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=10, stale-while-revalidate=59',
          },
        ],
      },
      // Permissive CORS for media assets loaded by the player
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
