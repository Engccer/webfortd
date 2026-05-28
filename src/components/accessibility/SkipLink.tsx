"use client"

const baseCls =
  "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"

export function SkipLink() {
  return (
    <>
      <a href="#main-content" className={`${baseCls} focus:top-4`}>
        본문 바로가기
      </a>
      <a href="#app-sidebar" className={`${baseCls} focus:top-16`}>
        메뉴 바로가기
      </a>
    </>
  )
}
