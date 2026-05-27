import type { NextConfig } from "next";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  // GitHub Pages: 정적 export 필요, Vercel: SSR/ISR 가능
  ...(isGitHubPages && { output: "export" }),
  basePath: isGitHubPages ? "/webfortd" : "",
  images: {
    unoptimized: true,
  },
  // public/library/ PDF 4건(41MB)이 Serverless Function bundle에 trace되어
  // 250MB 한계 초과(function_size_exceeded). static asset 서빙은 유지하면서
  // function bundle에서 제외. M3에서 외부 storage(Supabase Storage)로 마이그레이션 예정.
  outputFileTracingExcludes: {
    "*": ["public/library/**"],
  },
  async redirects() {
    return [
      // 위키 entry — /wiki → / 영구 redirect
      { source: "/wiki", destination: "/", permanent: true },

      // (gov) 정적 안내 → /legacy/* (Phase 4 M1, D7 호환성)
      { source: "/about", destination: "/legacy/about", permanent: true },
      { source: "/about/:path*", destination: "/legacy/about/:path*", permanent: true },
      { source: "/support", destination: "/legacy/support", permanent: true },
      { source: "/support/:path*", destination: "/legacy/support/:path*", permanent: true },
      { source: "/rights", destination: "/legacy/rights", permanent: true },
      { source: "/rights/:path*", destination: "/legacy/rights/:path*", permanent: true },
      { source: "/stories", destination: "/legacy/stories", permanent: true },
      { source: "/stories/:path*", destination: "/legacy/stories/:path*", permanent: true },
      { source: "/participate", destination: "/legacy/participate", permanent: true },
      { source: "/participate/:path*", destination: "/legacy/participate/:path*", permanent: true },

      // /resources 인덱스 + policy + statistics → /legacy/resources/* (D7)
      // 주의: /resources/law/[slug], /resources/research/[slug]는 atomic 콘텐츠 라우트라
      // (wiki) 그룹 그대로 유지. URL 보존 정합 (spec D4 §3.2, sourcePathToHref 변경 0).
      { source: "/resources", destination: "/legacy/resources", permanent: true },
      { source: "/resources/policy", destination: "/legacy/resources/policy", permanent: true },
      { source: "/resources/policy/:path*", destination: "/legacy/resources/policy/:path*", permanent: true },
      { source: "/resources/statistics", destination: "/legacy/resources/statistics", permanent: true },
      { source: "/resources/statistics/:path*", destination: "/legacy/resources/statistics/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
