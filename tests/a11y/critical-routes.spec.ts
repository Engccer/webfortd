// D8 — 6 핵심 라우트 a11y 검증
import { test } from '@playwright/test'
import { expectNoAxeViolations } from './axe-helper'

const ROUTES = [
  '/',
  '/chat',
  '/library',
  '/media',
  '/library/2023-hr-guide',
  '/legacy/about',
]

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }, info) => {
    await expectNoAxeViolations(page, info, route)
  })
}
