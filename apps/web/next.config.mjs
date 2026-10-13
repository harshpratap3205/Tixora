/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    const apiPort = process.env.INTERNAL_API_PORT || process.env.API_PORT || '8080';
    return [
      {
        source: '/api/v1/:path*',
        destination: `http://127.0.0.1:${apiPort}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

