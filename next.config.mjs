/** @type {import('next').NextConfig} */
const isStandalone = process.env.NEXT_OUTPUT === 'standalone';

const nextConfig = {
  ...(isStandalone ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  transpilePackages: ['@lobehub/ui', '@lobehub/fluent-emoji'],
  experimental: {
    esmExternals: 'loose',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Lobe-Trace, X-Lobe-Plugin-Settings, X-Lobe-Chat-Auth',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
