/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/daily-report', destination: '/', permanent: false },
    ];
  },
};
export default nextConfig;
