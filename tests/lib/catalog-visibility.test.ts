import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCatalogItemVisible } from '@/lib/catalog-visibility.ts'

describe('isCatalogItemVisible', () => {
  it('status 미표기(undefined) → 항상 노출 (published 간주)', () => {
    assert.equal(isCatalogItemVisible(undefined, false), true)
    assert.equal(isCatalogItemVisible(undefined, true), true)
  })

  it("status 'published' → 항상 노출", () => {
    assert.equal(isCatalogItemVisible('published', false), true)
    assert.equal(isCatalogItemVisible('published', true), true)
  })

  it("status 'draft' + 비-admin(includeUnpublished=false) → 숨김", () => {
    assert.equal(isCatalogItemVisible('draft', false), false)
  })

  it("status 'draft' + admin(includeUnpublished=true) → 노출", () => {
    assert.equal(isCatalogItemVisible('draft', true), true)
  })
})
