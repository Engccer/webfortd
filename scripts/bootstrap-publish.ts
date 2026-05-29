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
 * 핵심 invariant: 본문은 절대 변경하지 않는다 (frontmatter status/reviewed_by 라인만 치환).
 */
import { readFileSync, writeFileSync, globSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REVIEWER = '1차 검토(김헌용)'

export interface PromoteResult {
  changed: boolean
  output: string
}

/**
 * 한 .md raw 문자열의 frontmatter를 published로 승격.
 *
 * 라인 기반 정밀 치환 — gray-matter 재직렬화의 대량 포맷 변경(따옴표 제거, flow→block 등)을
 * 피하고 status/reviewed_by 라인만 바꾼다. 본문 + 나머지 frontmatter 필드 완전 보존.
 *
 * - frontmatter 블록(파일 첫 `---`~`---`)만 처리. 본문의 'status:' 같은 텍스트는 무시.
 * - status가 이미 published(따옴표 유무 무관)면 no-op.
 * - status 라인 → `status: published`.
 * - reviewed_by가 빈 배열(`[]`)이면 placeholder 추가. 그 외 형식(값 있음)은 보존.
 */
export function promoteFrontmatter(raw: string): PromoteResult {
  const fmMatch = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/)
  if (!fmMatch) return { changed: false, output: raw }
  const [full, open, body, close] = fmMatch

  // 이미 published (status: published 또는 status: "published")
  if (/^status:\s*["']?published["']?\s*$/m.test(body)) {
    return { changed: false, output: raw }
  }

  let newBody = body
  const afterStatus = newBody.replace(/^status:\s*\S.*$/m, 'status: published')
  if (afterStatus === newBody) {
    // status 라인이 없으면 승격 대상 아님 (frontmatter 비정형)
    return { changed: false, output: raw }
  }
  newBody = afterStatus

  // reviewed_by 빈 배열만 placeholder. 값 있는 형식(flow/block)은 보존.
  newBody = newBody.replace(
    /^reviewed_by:\s*\[\s*\]\s*$/m,
    `reviewed_by: ["${REVIEWER}"]`,
  )

  const output = raw.replace(full, open + newBody + close)
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
