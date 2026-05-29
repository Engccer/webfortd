# Phase B M1 — Publish 정합 + 사이트 채움 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 또는 executing-plans. 체크박스(`- [ ]`) 추적.

**Goal:** sync가 마크다운 frontmatter status를 반영하도록 고치고(B2), `kb:bootstrap`으로 527개 .md 정본을 published 승격(B1) → sync → DB published 535 정합. 위키 라우트는 무게이트 유지(M2 책임).

**Architecture:** publish = 정본(git) 변경으로 전환. (1) `sync-content-to-db.ts` line 117 draft 강제 제거 → frontmatter status 반영. (2) 신규 `scripts/bootstrap-publish.ts` — 마크다운 frontmatter 일괄 승격(dry-run 기본). (3) 기존 `publish-content.ts`(DB UPDATE)는 deprecate 경고 — B2 후 DB만 고치면 sync에서 복귀.

**Tech Stack:** gray-matter(frontmatter 파싱·재작성), tsx, node:test.

---

## 결정 잠금 (spec §4 출처)

| ID | 결정 | 출처 |
|----|------|------|
| B1 | bootstrap = 마크다운 frontmatter 승격(정본 수정) | spec B1 |
| B2 | sync가 frontmatter status 반영(line 117 draft 강제 제거) | spec B2 |
| B3 | reviewed_by placeholder = **"1차 검토(김헌용)"** (위원장 확정 2026-05-29) | spec B3 수정 |
| B4 | bootstrap dry-run 기본 + explicit `--apply` flag | spec B4 |
| **B9** | bootstrap은 **별도 스크립트** `kb:bootstrap`, 기존 `kb:publish`(DB UPDATE)는 deprecate | plan 발견 — DB UPDATE는 B2 후 obsolete |
| **B10** | bootstrap 대상 = status≠published인 .md 전부(draft/in_review). 가드(reviewed_by 등) 무시 — 위원장 "품질 OK" ack로 일괄 | plan |

---

## File Structure

| 경로 | 변경 | Task |
|------|------|------|
| `scripts/sync-content-to-db.ts:117` | `status: 'draft'` → `status: fm.status ?? 'draft'` | T1 |
| `tests/scripts/sync-content-to-db.test.ts` (해당 test) | D1 status draft 강제 검증 → frontmatter 반영 검증으로 갱신 | T1 |
| `scripts/bootstrap-publish.ts` | 신규 — 마크다운 frontmatter 승격 (dry-run 기본) | T2 |
| `tests/scripts/bootstrap-publish.test.ts` | 신규 — 승격 로직 단위(가짜 frontmatter in/out) | T2 |
| `scripts/publish-content.ts:1-27` | deprecate 경고 주석 + main 진입 시 경고 출력 | T3 |
| `package.json` | `kb:bootstrap` + `kb:bootstrap:dry-run` script | T2 |

---

# Task 1 — sync가 frontmatter status 반영 (B2)

**Files:** `scripts/sync-content-to-db.ts:117`, 해당 test

- [ ] **Step 1-1: 기존 test 확인** — D1(status draft 강제)를 검증하는 test를 찾아 frontmatter 반영으로 갱신할 대상 식별.

```bash
grep -rn "status.*draft\|D1" tests/scripts/sync-content-to-db.test.ts
```

- [ ] **Step 1-2: transformDocumentRow 수정**

`scripts/sync-content-to-db.ts:117`:
```ts
// 변경 전
status: 'draft', // D1
// 변경 후 (B2): frontmatter status 반영. 마크다운이 정본.
status: fm.status ?? 'draft',
```

상단 D1 주석(line 63, 94)도 B2로 갱신.

- [ ] **Step 1-3: test 갱신** — frontmatter status='published'면 row.status='published' 검증. frontmatter 없으면 'draft' fallback.

- [ ] **Step 1-4: 테스트 실행**
```bash
npm test -- tests/scripts/sync-content-to-db.test.ts
```
Expected: PASS.

- [ ] **Step 1-5: Commit** — `feat(sync): frontmatter status 반영 (B2, D1 draft 강제 제거)`

---

# Task 2 — bootstrap-publish 스크립트 (B1)

**Files:** `scripts/bootstrap-publish.ts`, `tests/scripts/bootstrap-publish.test.ts`, `package.json`

- [ ] **Step 2-1: 단위 test 먼저 작성 (TDD)** — 순수 함수 `promoteFrontmatter(raw: string): { changed: boolean; output: string }`.

```ts
// draft → published + reviewed_by 추가
import { promoteFrontmatter } from '../../scripts/bootstrap-publish.ts'
// case 1: status: draft → published, reviewed_by 빈 배열 → ["1차 검토(김헌용)"]
// case 2: 이미 published → changed=false (idempotent)
// case 3: reviewed_by 이미 값 있음 → placeholder 추가 안 함(중복 방지), status만 변경
// case 4: 본문은 절대 안 건드림 (frontmatter만)
```

- [ ] **Step 2-2: promoteFrontmatter 구현** — gray-matter로 파싱, `data.status`/`data.reviewed_by` 수정, `matter.stringify`로 재작성. 본문 보존.

```ts
import matter from 'gray-matter'

const REVIEWER = '1차 검토(김헌용)'

export function promoteFrontmatter(raw: string): { changed: boolean; output: string } {
  const parsed = matter(raw)
  const data = parsed.data as { status?: string; reviewed_by?: string[] }
  if (data.status === 'published') return { changed: false, output: raw }
  data.status = 'published'
  const reviewed = Array.isArray(data.reviewed_by) ? data.reviewed_by : []
  if (reviewed.length === 0) data.reviewed_by = [REVIEWER]
  const output = matter.stringify(parsed.content, data)
  return { changed: true, output }
}
```

- [ ] **Step 2-3: CLI main** — `content/**/*.md` glob, 각 파일 promoteFrontmatter, dry-run(기본)은 변경 대상 목록 출력, `--apply`만 실제 writeFileSync. 변경 카운트 보고.

- [ ] **Step 2-4: package.json scripts**
```json
"kb:bootstrap:dry-run": "node --import tsx scripts/bootstrap-publish.ts",
"kb:bootstrap": "node --import tsx scripts/bootstrap-publish.ts --apply"
```

- [ ] **Step 2-5: 테스트 실행 + Commit** — `feat(scripts): kb:bootstrap 마크다운 frontmatter 승격 (B1)`

---

# Task 3 — publish-content deprecate (B9)

**Files:** `scripts/publish-content.ts`

- [ ] **Step 3-1: deprecate 경고** — 파일 상단 주석 + main() 진입 시 stderr 경고:
```
경고: kb:publish(DB UPDATE 방식)는 B2 이후 deprecated.
DB status를 직접 바꿔도 다음 kb:sync에서 마크다운 frontmatter status로 복귀됩니다.
published 전환은 마크다운 frontmatter 수정(kb:bootstrap 또는 직접 편집) → kb:sync를 사용하세요.
```
기존 동작은 보존(하위 호환), 경고만 추가.

- [ ] **Step 3-2: Commit** — `chore(scripts): publish-content DB UPDATE 방식 deprecate 경고`

---

# Task 4 — bootstrap 실행 + sync + 535 정합 (위원장 체크포인트)

- [ ] **Step 4-1: dry-run** — `npm run kb:bootstrap:dry-run` → 변경 대상 527건 목록 출력.
- [ ] **Step 4-2: 위원장 확인** — dry-run 결과(527건 + reviewer 명칭) 위원장에게 보여주고 apply 승인.
- [ ] **Step 4-3: apply** — `npm run kb:bootstrap` → 527 .md 수정.
- [ ] **Step 4-4: 빌드 인덱스 갱신** — `npm run build`(validate:content + sync:content)로 kb-index.generated.json 갱신.
- [ ] **Step 4-5: DB sync** — `npm run kb:sync` → DB published 535 반영.
- [ ] **Step 4-6: 정합 검증** — 대시보드 또는 진단으로 마크다운 535 = DB published 535 확인.
- [ ] **Step 4-7: Commit** — 527 .md frontmatter 변경(`feat(content): 527 페이지 published 승격 (1차 검토 김헌용, bootstrap)`).

---

# Task 5 — codex-rescue + PR

- [ ] **Step 5-1: codex doctor** (글로벌 규칙)
- [ ] **Step 5-2: codex-rescue** — 리뷰 포커스: sync status 반영이 idempotent sync 깨지 않는지, bootstrap이 본문 안 건드리는지, dry-run 기본 강제, reviewed_by placeholder 오용 방지.
- [ ] **Step 5-3: coderabbit** (보완)
- [ ] **Step 5-4: PR + admin merge + production 검증** (대시보드 535 published).
- [ ] **Step 5-5: MEMORY.md + CLAUDE.md 갱신** (B2·B9 영구 결정).

---

## Self-Review

- spec M1 산출물 1~3 모두 Task 매핑 ✓
- B1·B2·B3·B4·B9·B10 결정 plan 반영 ✓
- 본문 보존(promoteFrontmatter가 frontmatter만 수정) 회귀 가드 Step 2-1 case 4 ✓
- 위원장 체크포인트(527 파일 수정 직전 dry-run 확인) Step 4-2 ✓
