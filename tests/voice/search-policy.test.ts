import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEARCH_POLICY_DECLARATION } from '../../src/lib/voice/search-policy.ts'

test('search_policy 선언 shape', () => {
  assert.equal(SEARCH_POLICY_DECLARATION.name, 'search_policy')
  assert.ok(SEARCH_POLICY_DECLARATION.parameters?.properties?.query)
  assert.deepEqual(SEARCH_POLICY_DECLARATION.parameters?.required, ['query'])
})
