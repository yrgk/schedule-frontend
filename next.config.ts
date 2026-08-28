import type { NextConfig } from "next";
import { APP_BASE_PATH } from "./app/_config/app";

const nextConfig: NextConfig = {
  basePath: APP_BASE_PATH,
  output: "standalone",
};

export default nextConfig;
