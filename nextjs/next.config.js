/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces .next/standalone for a slim Docker runtime image (`node server.js`).
  output: 'standalone',

  // Proxy /api/* to the Express server. In Docker the destination is
  // http://api:4000 (compose service name); locally it's http://localhost:4000.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
