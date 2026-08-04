// Phase A — AdminBar 비-admin 비노출 가드 + a11y 회귀 방지
//
// Playwright 세션은 기본적으로 비로그인(=비-admin). 따라서 모든 라우트에서
// AdminBar region이 노출되면 안 된다.
// admin 로그인 a11y는 Phase B에서 magic-link 인증 stub과 함께 추가.

import { test, expect } from '@playwright/test'
import { expectNoAxeViolations } from './axe-helper'

test.describe('AdminBar — 비-admin 비노출', () => {
  test('/ 라우트에 관리자 모드 바 없음', async ({ page }) => {
    await page.goto('/')
    // role=region 제거 — "관리자 모드" 텍스트 부재로 AdminBar 비노출 확인 (미니멀 접근성)
    await expect(page.getByText('관리자 모드')).toHaveCount(0)
  })

  test('/library 라우트에 관리자 모드 바 없음', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByText('관리자 모드')).toHaveCount(0)
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

  // 편집기 트랙: round 2 수정으로 (wiki)/editor는 admin layout 게이트를 쓰지 않는다.
  // editor 역할 감수자가 대시보드 없이 편집기에만 도달해야 하므로(spec §5 권한 행렬),
  // admin/* 전용 게이트에서 분리해 자체 게이트(loadDocument forbidden 처리 + 안내 화면)로
  // 완결한다. slug 없이 접근하면 loadDocument조차 호출하지 않고 안내 문구를 그대로 렌더한다.
  // redirect가 아니라 그 화면 자체가 비로그인·무권한 사용자의 종착점이다.
  test('비-admin 사용자가 /editor 접근 시 안내 화면이 그대로 렌더된다(redirect 아님)', async ({ page }) => {
    const response = await page.goto('/editor')
    await expect(page).toHaveURL(/\/editor$/)
    expect(response?.ok()).toBe(true)
    await expect(page.getByText('편집할 문서 페이지에서 편집 버튼으로 들어와 주세요.')).toBeVisible()
  })

  test('a11y: /editor 안내 화면 axe-core PASS', async ({ page }, info) => {
    await expectNoAxeViolations(page, info, '/editor')
  })
})
