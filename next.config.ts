import type { NextConfig } from 'next';
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    '/api/strong': ['./data/strong.sqlite'],
    '/api/treasury': ['./data/treasury.sqlite'],
    '/api/matthew-henry': ['./data/matthew_henry.sqlite'],
    '/api/nave': ['./data/nave.sqlite'],
    '/api/sqlite/health': ['./data/*.sqlite'],
  },
  async redirects() {
    return [
      {
        source: "/spiritual",
        destination: "/community",
        permanent: false,
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  customWorkerDir: "worker",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
