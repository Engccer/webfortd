import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_ENTRIES } from '../../src/lib/wiki-role-entries'

test('ROLE_ENTRIES — 5장 정확 (다층 사용자 원칙)', () => {
  assert.equal(ROLE_ENTRIES.length, 5)
})

test('ROLE_ENTRIES — 모든 role unique', () => {
  const roles = ROLE_ENTRIES.map((e) => e.role)
  assert.equal(new Set(roles).size, roles.length)
})

test('ROLE_ENTRIES — 각 항목 필수 필드 (title, description, icon)', () => {
  for (const e of ROLE_ENTRIES) {
    assert.ok(e.title, `${e.role}: title 누락`)
    assert.ok(e.description, `${e.role}: description 누락`)
    assert.ok(e.icon, `${e.role}: icon 누락`)
  }
})
