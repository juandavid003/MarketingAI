import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Raw video uploads for the AI editing pipeline are far larger than
      // the 1MB default.
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
