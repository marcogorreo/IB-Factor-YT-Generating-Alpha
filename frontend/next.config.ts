import type { NextConfig } from "next";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

/** CDN YouTube: i.ytimg.com e i1…i9.ytimg.com per le anteprime */
const ytimgHostnames = [
  "i.ytimg.com",
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `i${n}.ytimg.com`),
];
const ytimgRemotePatterns = ytimgHostnames.flatMap((hostname) => [
  {
    protocol: "https" as const,
    hostname,
    pathname: "/vi/**",
  },
  {
    protocol: "https" as const,
    hostname,
    pathname: "/vi_webp/**",
  },
]);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: ytimgRemotePatterns,
  },
};

export default nextConfig;
