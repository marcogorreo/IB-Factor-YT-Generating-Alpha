import type { NextConfig } from "next";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
