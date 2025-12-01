import type { NextConfig } from "next";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  // GitHub Pages: 정적 export 필요, Vercel: SSR/ISR 가능
  ...(isGitHubPages && { output: "export" }),
  basePath: isGitHubPages ? "/webfortd" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
