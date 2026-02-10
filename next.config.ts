import type { NextConfig } from 'next';
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
