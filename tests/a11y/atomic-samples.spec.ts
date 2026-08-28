// D8 — atomic axis별 샘플 3건 a11y 검증.
// 샘플은 고정 (회귀 재현성). 실제 atomic slug = kb-index.generated.json 조회 결과.
import { test } from '@playwright/test'
import { expectNoAxeViolations } from './axe-helper'

const ATOMIC_SAMPLES = [
  '/disability-types/2023-hr-x1-x3',
  '/policies/2023-hr-2-2-1',
  '/agreements/2020-ca-1-2',
]

for (const route of ATOMIC_SAMPLES) {
  test(`a11y atomic: ${route}`, async ({ page }, info) => {
    await expectNoAxeViolations(page, info, route)
  })
}
