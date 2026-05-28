import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * jsdom 미구현 API 글로벌 stub.
 * 가드(`typeof X === "undefined"`)로 useMediaQuery 테스트의 per-test
 * `window.matchMedia = vi.fn().mockReturnValue(mql)` 재할당과 충돌 안 함.
 * (useMediaQuery 테스트는 stub 설치 후 각 it()에서 자신의 mock으로 덮어쓰기)
 */
beforeAll(() => {
  if (typeof window.matchMedia === 'undefined') {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

// Vitest globals:false 설정에서는 testing-library auto cleanup 미적용
// → 매 테스트 후 DOM 명시 정리 (이전 테스트의 노드 누적 회피)
afterEach(() => {
  cleanup()
})
