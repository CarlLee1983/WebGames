import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/WebGames" : "",
  images: {
    unoptimized: true,
  },
  turbopack: {
    disableOptimization: true,
  }
};

export default nextConfig;
