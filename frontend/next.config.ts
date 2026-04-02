import type { NextConfig } from "next";

// `standalone` is for Docker images; Vercel expects the default build output (standalone -> 404 on prod).
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  ...(!isVercel ? { output: "standalone" as const } : {}),
  experimental: {
    // Disable Turbopack file system cache to avoid SST corruption
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
