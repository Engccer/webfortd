/**
 * webfortd Phase B M1 — bootstrap publish (B1)
 *
 * content 디렉터리의 모든 .md 정본의 frontmatter status를 published로 일괄 승격한다.
 * 마크다운이 정본이므로 published 전환은 DB UPDATE가 아니라 *정본 수정*으로 한다(B2 정합).
 * 승격 후 kb:sync가 DB에 published 반영.
 *
 * 동작:
 *   - dry-run (기본): 변경 대상 목록 + 카운트만 출력. 파일 미변경.
 *   - apply (`--apply`): 실제 .md 파일 frontmatter 재작성.
 *
 * 위원장 "품질 OK" ack로 가드(reviewed_by 등) 무시하고 status≠published 전부 일괄 승격(B10).
 * reviewed_by가 비어있으면 placeholder "1차 검토(김헌용)" 추가 — audit trail(B3).
 *
 * 핵심 invariant: 본문은 절대 변경하지 않는다 (gray-matter frontmatter만 재작성).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { globSync } from 'node:fs'
import matter from 'gray-matter'

const REVIEWER = '1차 검토(김헌용)'

export interface PromoteResult {
  changed: boolean
  output: string
}

/**
 * 한 .md raw 문자열의 frontmatter를 published로 승격.
 * - status가 이미 published면 no-op (changed=false).
 * - reviewed_by 빈 배열이면 placeholder 추가. 값 있으면 보존.
 * - 본문(parsed.content)은 그대로.
 */
export function promoteFrontmatter(raw: string): PromoteResult {
  const parsed = matter(raw)
  const data = parsed.data as { status?: string; reviewed_by?: string[] }
  if (data.status === 'published') {
    return { changed: false, output: raw }
  }
  data.status = 'published'
  const reviewed = Array.isArray(data.reviewed_by) ? data.reviewed_by : []
  if (reviewed.length === 0) {
    data.reviewed_by = [REVIEWER]
  }
  const output = matter.stringify(parsed.content, data)
  return { changed: true, output }
}

// ---------- CLI main ----------

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const files = globSync('content/**/*.md')

  const changedFiles: string[] = []
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const { changed, output } = promoteFrontmatter(raw)
    if (changed) {
      changedFiles.push(file)
      if (apply) writeFileSync(file, output, 'utf8')
    }
  }

  console.log('========================================')
  console.log(`Bootstrap publish (${new Date().toISOString()})`)
  console.log(`Mode: ${apply ? 'APPLY (파일 수정)' : 'DRY-RUN (변경 없음)'}`)
  console.log('========================================')
  console.log(`총 .md 파일:        ${files.length}`)
  console.log(`승격 대상 (status≠published): ${changedFiles.length}`)
  console.log(`reviewer placeholder: "${REVIEWER}" (reviewed_by 비어있을 때만)`)
  console.log('')
  if (changedFiles.length > 0) {
    console.log('승격 대상 샘플 (최대 20):')
    for (const f of changedFiles.slice(0, 20)) {
      console.log(`  - ${f}`)
    }
    if (changedFiles.length > 20) {
      console.log(`  … 외 ${changedFiles.length - 20}건`)
    }
    console.log('')
  }
  if (apply) {
    console.log(`Action: ${changedFiles.length}개 .md frontmatter 승격 완료. 다음: npm run build → npm run kb:sync`)
  } else {
    console.log('Action: dry-run 종료. 실제 승격은 npm run kb:bootstrap')
  }
}

const invokedPath = process.argv[1]
  ? fileURLToPath(new URL(`file://${process.argv[1]}`))
  : ''
const modulePath = fileURLToPath(import.meta.url)
if (invokedPath === modulePath) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
