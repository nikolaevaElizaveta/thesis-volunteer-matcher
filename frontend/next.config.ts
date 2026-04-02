import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Disable Turbopack file system cache to avoid SST corruption
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
