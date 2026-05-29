import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePreviewActive,
  shouldRenderUnderReview,
} from '@/lib/admin/preview-policy.ts'

describe('preview-policy', () => {
  it('computePreviewActive: draft off → 항상 false', () => {
    assert.equal(computePreviewActive(false, true), false)
    assert.equal(computePreviewActive(false, false), false)
  })

  it('computePreviewActive: draft on + admin → true', () => {
    assert.equal(computePreviewActive(true, true), true)
  })

  it('computePreviewActive: draft on + 비-admin → false (cookie 누수 방어)', () => {
    assert.equal(computePreviewActive(true, false), false)
  })

  it('shouldRenderUnderReview: published는 미리보기와 무관하게 노출', () => {
    assert.equal(shouldRenderUnderReview('published', false), false)
    assert.equal(shouldRenderUnderReview('published', true), false)
  })

  it('shouldRenderUnderReview: non-published & 비-미리보기 → 검수 중', () => {
    for (const s of ['draft', 'in_review', 'archived', 'deprecated']) {
      assert.equal(shouldRenderUnderReview(s, false), true)
    }
  })

  it('shouldRenderUnderReview: non-published & 미리보기 → 본문 노출', () => {
    assert.equal(shouldRenderUnderReview('draft', true), false)
  })
})
