// axe-core 공통 헬퍼 — critical violation 0건 검증.
// PR B 도입 시점 baseline:
//   serious — color-contrast (6 routes, 디자인 시스템 색 대비) + link-name (1건 /legacy/about)
// 이 baseline은 별도 fix PR로 격리 (디자인 시스템 손질 필요). 본 helper는 *추가 회귀 차단*에 집중.
// 후속 PR로 serious까지 blocking 확장 예정 — `serious_baseline_fix` 큐 참조.

import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

const BLOCKING_IMPACTS = new Set(['critical'])
const WARNING_IMPACTS = new Set(['serious'])

export async function expectNoAxeViolations(page: Page, info: TestInfo, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))
  const warnings = results.violations.filter((v) => WARNING_IMPACTS.has(v.impact ?? ''))

  if (blocking.length > 0 || warnings.length > 0) {
    const fmt = (v: (typeof results.violations)[number]) =>
      `[${v.impact}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n  affected: ${v.nodes.length} node(s)`
    const report = [...blocking, ...warnings].map(fmt).join('\n\n')
    await info.attach('axe-violations', { body: report, contentType: 'text/plain' })
  }

  if (warnings.length > 0) {
    console.warn(`[a11y warning] ${route} — serious ${warnings.length}건 (별도 fix PR 큐)`)
  }

  expect(blocking, `${route} — critical 0건 기대, ${blocking.length}건 발견`).toEqual([])
}
