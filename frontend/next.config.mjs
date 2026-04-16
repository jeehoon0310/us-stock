/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  async rewrites() {
    return [
      { source: '/daily-report', destination: '/daily_report.html' },
      { source: '/notice', destination: '/notice.html' },
    ];
  },
};
export default nextConfig;
