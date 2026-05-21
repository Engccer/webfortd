import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * `.env.local`의 키-값을 process.env에 *덮어쓰는* 방식으로 로딩한다.
 *
 * **왜 `node --env-file=.env.local`로 충분하지 않은가**:
 * Node의 `--env-file`은 이미 process.env에 존재하는 키를 *덮어쓰지 않는다*.
 * 다중 프로젝트를 다루는 사용자 환경에서 `~/.zshrc`에 다른 프로젝트의
 * `SUPABASE_SECRET_KEY`가 export되어 있으면 webfortd/.env.local의 정확한
 * 키 대신 shell의 stale 키가 사용되어 "Invalid API key" 401을 받는다.
 *
 * 이 헬퍼는 `.env.local`에 명시된 키를 *우선시*해서 shadowing 사고를 차단.
 * direnv hook이 정상 작동하면 결과는 동일하지만, direnv가 미발동인 컨텍스트
 * (non-interactive shell, 일부 IDE)에서도 안전하게 동작.
 *
 * 사용처: scripts/sync-content-to-db.ts, scripts/publish-content.ts,
 * tests/migrations/*.test.ts (통합 테스트 before 블록).
 * 위치: scripts/lib/ (production script와 test 모두 import — production 코드가
 * tests/ 디렉터리에 의존하지 않도록 lib 영역에 배치).
 */
export function loadDotEnvLocalOverrides(): void {
  const dotenvPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(dotenvPath)) return
  const raw = fs.readFileSync(dotenvPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
