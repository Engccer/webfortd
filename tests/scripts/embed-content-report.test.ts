import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('embed-content 보고서 헤더 (M1 carry #3)', () => {
  test('dry-run 출력에 모델/dim 한 줄 포함', () => {
    const repo = path.resolve(__dirname, '../..')
    const result = spawnSync(
      'node',
      ['--import', 'tsx', 'scripts/embed-content.ts', '--dry-run'],
      { cwd: repo, encoding: 'utf8', timeout: 60_000 },
    )
    // dry-run은 DB·SDK 호출 없이 안전. fixture 없이도 fail 안 함.
    const out = result.stdout + result.stderr
    assert.match(
      out,
      /모델:\s*gemini-embedding-2-preview\s*\/\s*dim:\s*1536/,
      `보고서 헤더에 model/dim 누락. stdout=${result.stdout.slice(0, 500)}`,
    )
  })
})
