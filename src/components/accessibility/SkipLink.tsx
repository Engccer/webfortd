"use client"

const baseCls =
  "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"

export function SkipLink() {
  return (
    <>
      <a href="#main-content" className={`${baseCls} focus:top-4`}>
        본문 바로가기
      </a>
      <a
        href="#app-sidebar"
        className={`${baseCls} focus:top-16`}
        onClick={() => {
          // 접힘(데스크탑)/닫힘(모바일) 사이드바는 inert라 앵커 이동만으로는 무동작 —
          // Alt+2 단축키와 동일한 이벤트 경로(AppShell 수신)로 사이드바를 열고 포커스를 옮긴다.
          // preventDefault 없음: 리스너가 없는 환경에서도 기본 앵커 동작이 fallback으로 유지된다.
          window.dispatchEvent(new CustomEvent("webfortd:open-sidebar"))
        }}
      >
        메뉴 바로가기
      </a>
    </>
  )
}
