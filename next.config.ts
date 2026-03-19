import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/web-games",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
