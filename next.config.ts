import type { NextConfig } from "next";
import { enforceAuthSecretOrExit } from "./lib/auth-secret";

// Runs in the `next dev` parent, before the worker is forked, so `npx next dev`
// exits 1 on a bad AUTH_SECRET. `npm run dev` still uses scripts/next-dev-exit.cjs.
enforceAuthSecretOrExit(process.env.AUTH_SECRET);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["ioredis"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
