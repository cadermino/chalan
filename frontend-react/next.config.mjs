/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
