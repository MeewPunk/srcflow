import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // loads native lightningcss at runtime (api/tw-css); Turbopack can't bundle it
  serverExternalPackages: ["@tailwindcss/node"],
};

export default nextConfig;
