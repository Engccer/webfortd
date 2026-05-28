// Phase A — AdminBar 비-admin 비노출 가드 + a11y 회귀 방지
//
// Playwright 세션은 기본적으로 비로그인(=비-admin). 따라서 모든 라우트에서
// AdminBar region이 노출되면 안 된다.
// admin 로그인 a11y는 Phase B에서 magic-link 인증 stub과 함께 추가.

import { test, expect } from '@playwright/test'
import { expectNoAxeViolations } from './axe-helper'

test.describe('AdminBar — 비-admin 비노출', () => {
  test('/ 라우트에 관리자 도구 모음 region 없음', async ({ page }) => {
    await page.goto('/')
    const region = page.getByRole('region', { name: '관리자 도구 모음' })
    await expect(region).toHaveCount(0)
  })

  test('/library 라우트에 관리자 도구 모음 region 없음', async ({ page }) => {
    await page.goto('/library')
    const region = page.getByRole('region', { name: '관리자 도구 모음' })
    await expect(region).toHaveCount(0)
  })

  test('비-admin 사용자가 /admin/dashboard 접근 시 redirect', async ({ page }) => {
    const response = await page.goto('/admin/dashboard')
    // server-side redirect → 최종 URL은 / 이거나 200 응답
    await expect(page).toHaveURL(/\/(?:$|\?)/)
    expect(response?.ok()).toBe(true)
  })

  test('a11y: /admin/dashboard 비-admin 접근 후 / 라우트 axe-core PASS', async ({
    page,
  }, info) => {
    await page.goto('/admin/dashboard')
    // redirect 결과 / 또는 어느 라우트든 axe-core 통과해야 함
    await expectNoAxeViolations(page, info, '/')
  })
})
