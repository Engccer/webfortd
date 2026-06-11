import type { NextConfig } from "next";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  // GitHub Pages: 정적 export 필요, Vercel: SSR/ISR 가능
  ...(isGitHubPages && { output: "export" }),
  basePath: isGitHubPages ? "/webfortd" : "",
  images: {
    unoptimized: true,
  },
  // 보안 응답 헤더 — clickjacking(frame-ancestors)·MIME 스니핑·referrer 누출 방어.
  // HSTS는 Vercel 플랫폼이 *.vercel.app에 기본 제공. GitHub Pages export 모드에서는
  // headers()가 무시되지만(정적 export 한계) Vercel 경로가 production이므로 충분.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // 위키 entry — /wiki → / 영구 redirect
      { source: "/wiki", destination: "/", permanent: true },

      // (gov) 정적 안내 → /legacy/* (Phase 4 M1, D7 호환성)
      // NOTE: /about 및 /about/:path*는 2026-05-29 PR #61에서 위키 그룹 안 신규
      // About 페이지(/about)를 도입하면서 제거됨. 레거시 사이트의 about은
      // /legacy/about에서 직접 접근.
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
