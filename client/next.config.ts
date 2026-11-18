import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // Tree-shake icon / 3D helper barrels so routes only ship what they import.
    optimizePackageImports: ["lucide-react", "@react-three/drei", "recharts"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    qualities: [70, 80],
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
