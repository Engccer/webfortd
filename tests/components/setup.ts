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
  // Node 26의 실험적 전역 localStorage(--localstorage-file 미지정 시 undefined 반환)가
  // jsdom 자체 구현을 가려 window.localStorage가 undefined로 남는 환경 버그 회피.
  // 실제 Storage 인터페이스와 동형인 메모리 폴리필로 대체 — editor-client 등
  // localStorage를 쓰는 컴포넌트 테스트가 jsdom 정상 동작을 가정할 수 있게 한다.
  if (typeof window.localStorage === 'undefined') {
    class MemoryStorage {
      private store = new Map<string, string>()
      getItem(key: string) {
        return this.store.has(key) ? this.store.get(key)! : null
      }
      setItem(key: string, value: string) {
        this.store.set(key, String(value))
      }
      removeItem(key: string) {
        this.store.delete(key)
      }
      clear() {
        this.store.clear()
      }
      key(index: number) {
        return Array.from(this.store.keys())[index] ?? null
      }
      get length() {
        return this.store.size
      }
    }
    const memoryStorage = new MemoryStorage() as unknown as Storage
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })
  }
})

// Vitest globals:false 설정에서는 testing-library auto cleanup 미적용
// → 매 테스트 후 DOM 명시 정리 (이전 테스트의 노드 누적 회피)
afterEach(() => {
  cleanup()
})
