/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/daily-report', destination: '/daily_report.html' },
    ];
  },
};
export default nextConfig;
