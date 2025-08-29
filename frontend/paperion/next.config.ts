import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/downloads/:path*",
        destination: "http://backend:8000/downloads/:path*",
      },
    ];
  },
};

export default nextConfig;
