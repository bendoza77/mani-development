import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate folder lets a production build run while `next dev` uses .next (see the
  // "building" guide in node_modules/next/dist/docs). Unset = the usual .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
