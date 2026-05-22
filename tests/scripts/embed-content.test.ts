import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../..')

test('embed-content dry-run — 정확한 보고서 형식 출력', () => {
  const result = spawnSync(
    'node',
    ['--env-file=.env.local', '--import', 'tsx', 'scripts/embed-content.ts', '--dry-run'],
    { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env } },
  )
  assert.equal(result.status, 0, `stderr: ${result.stderr}`)
  assert.match(result.stdout, /=== DRY-RUN MODE ===/)
  assert.match(result.stdout, /마크다운 문서 \d+개 로드/)
  assert.match(result.stdout, /청크 총 \d+개/)
  assert.match(result.stdout, /임베딩 호출\/DB 쓰기 skip/)
})

test('embed-content dry-run — 임베딩 API 호출 0건', () => {
  // 환경변수 GOOGLE_GENERATIVE_AI_API_KEY가 없어도 dry-run은 통과해야 함
  const env = { ...process.env }
  delete env.GOOGLE_GENERATIVE_AI_API_KEY
  const result = spawnSync(
    'node',
    ['--env-file=.env.local', '--import', 'tsx', 'scripts/embed-content.ts', '--dry-run'],
    { cwd: REPO_ROOT, encoding: 'utf8', env },
  )
  assert.equal(result.status, 0, `API key 없이도 dry-run 통과 필수. stderr: ${result.stderr}`)
})
