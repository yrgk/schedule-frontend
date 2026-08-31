import type { NextConfig } from "next";

const scheduleApiBaseUrl = process.env.SCHEDULE_API_BASE_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    if (!scheduleApiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${scheduleApiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
