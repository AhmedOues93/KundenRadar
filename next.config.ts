import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions receive user supplied URLs only; keep body limit small.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
