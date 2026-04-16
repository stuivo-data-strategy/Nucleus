/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['recharts'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
