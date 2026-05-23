import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest globals:false 설정에서는 testing-library auto cleanup 미적용
// → 매 테스트 후 DOM 명시 정리 (이전 테스트의 노드 누적 회피)
afterEach(() => {
  cleanup()
})
