/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/v2',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://flask:8001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
