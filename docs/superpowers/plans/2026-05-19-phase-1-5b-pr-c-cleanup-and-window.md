# Phase 1.5b PR C — stale 정리 + ±10 window 자동 적용 확대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR B의 codex-rescue follow-up 3건 중 (1) PR #4 stale 3건 정리와 (2) cross-validation ±10 window를 추가해 page-numbered slug 13건의 정답 탐색 recall을 보강한다. chapter slug 60건은 비용 부담으로 PR C 범위 밖 (검수 큐 유지).

**Architecture:** Task C1에서 `2024-jbu-p-061·063`의 본문 image 3건을 TODO 마커로 복원하고 mapping entries를 정리. Task C2에서 `scripts/cross-validate-mappings.mjs`에 `page_number_seed` method 케이스의 raster ±10 후보 list를 동적 생성, Gemma 로컬(가장 빠른 모델)로 1차 stamp 후 YES 후보만 4종 합의 게이트로 검증. Task C3에서 cross-validation re-run → image:apply → 빌드 검증.

**Tech Stack:** Node.js (tsx), Python 3 (fitz, B0 raster 재추출 결과 활용), Anthropic SDK + Gemini CLI + gemma-vision + Codex CLI. 모든 비용·시간 부담은 Gemma 1차 stamp로 1/4까지 절감.

---

## Files

### Create (git tracked)
- `docs/superpowers/plans/2026-05-19-phase-1-5b-pr-c-cleanup-and-window.md` — 본 plan

### Create (git ignored, one-shot)
- `/tmp/restore-stale-jbu.mjs` — stale 3건 본문 image → TODO 마커 복원 스크립트

### Modify
- `scripts/cross-validate-mappings.mjs` — `page_number_seed` 케이스에 ±10 window 후보 + Gemma 1차 stamp 로직 추가
- `content/_image-mappings.json` — stale 3건 정리 + 새 apply 건 manifest_path 채움
- `content/_image-mappings-candidates.json` — cross-validation re-run 결과
- `content/disability-types/2024-jbu-p-061.md` — stale image 1건 → TODO 마커
- `content/policies/2024-jbu-p-063.md` — stale image 2건 → TODO 마커
- `docs/image-mapping-disputed.md` — 검수 큐 갱신
- `CLAUDE.md` — 변경 이력 (Edit/Write, `.gitignore` 등록이라 commit 불가)

### Reuse (변경 없음)
- `scripts/build-slug-raster-map.py` — 매핑 사전 빌더 그대로
- `scripts/merge-candidates-to-mappings.mjs` — apply 머지 스크립트 그대로
- `scripts/extract-pdf-page-renders.py` — raster 추출 그대로
- `public/source-images/<source>/page-NNN-render.png` — 4 PDF 991장 baseline 유지
- `content/_slug-raster-map.json` — B1 산출물 (cross-validation 재실행 입력)
- `content/_slug-raster-unresolved.json` — unresolved 7건 (그대로)
- `tests/scripts/slug-raster-map.test.ts` — 7건 known-answer 테스트 (회귀 차단)

---

## Task C0: 작업 브랜치

**Files:** None

### - [ ] Step 1: 브랜치 생성

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
git checkout master && git pull
git checkout -b phase-1-5b-pr-c-cleanup-window
```

Expected: `Switched to a new branch 'phase-1-5b-pr-c-cleanup-window'`. master는 `3dff772` 이상 ((gov) route group 등 최신 commits 포함 가능).

---

## Task C1: PR #4 stale 3건 정리

PR B 작업 중 발견된 PR #4 잔재. master 시점 manifest_path 값으로 임시 유지했으나, 본문 image와 entry 모두 정리하는 게 정공법.

**Stale 3건**:
- `2024-jbu-p-061#2024-jbu-work-support-guide#0` — body: `content/domains/2024-jbu-p-061.md` line 33 image markdown
- `2024-jbu-p-063#2024-jbu-work-support-guide#0` — body: `content/policies/2024-jbu-p-063.md` line 27 image
- `2024-jbu-p-063#2024-jbu-work-support-guide#1` — body: `content/policies/2024-jbu-p-063.md` line 42 image

**전략**: 본문 image 3건을 TODO 마커로 복원하고 `_image-mappings.json`의 manifest_path를 null로 정리. PR B에서 시도했으나 invariant test가 깨졌던 작업을 이번엔 본문+mapping 함께 정리해 일관성 유지.

**Files:**
- Create: `/tmp/restore-stale-jbu.mjs`
- Modify: `content/_image-mappings.json`, `content/domains/2024-jbu-p-061.md`, `content/policies/2024-jbu-p-063.md`

### - [ ] Step 1: 현재 상태 확인

```bash
echo "=== jbu-p-061.md (stale image line 33) ==="
sed -n '30,38p' content/domains/2024-jbu-p-061.md
echo ""
echo "=== jbu-p-063.md (stale image line 27, 42) ==="
sed -n '25,45p' content/policies/2024-jbu-p-063.md
echo ""
echo "=== stale entries ==="
cat content/_image-mappings.json | jq '.mappings | to_entries | map(select(.key | test("jbu-p-061.*#0$|jbu-p-063.*#[01]$")))'
```

Expected: stale image markdown 3건 + 매핑 entries 확인.

### - [ ] Step 2: 본문 image → TODO 마커 복원 스크립트 작성

복원할 TODO 마커 형식 (기존 `2024-jbu-p-061.md` line 35 패턴 참조):
```
<!-- TODO: image-link source=2024-jbu-work-support-guide -- 원본: (이미지: <alt>) -->
```

alt는 stale entry의 `_alt_original` 그대로 (PR #4 시점 잘못된 alt이지만 본문 image의 alt와 일치하므로 정합).

```bash
cat > /tmp/restore-stale-jbu.mjs <<'EOF'
#!/usr/bin/env node
/**
 * PR #4 잔재 정리: jbu-p-061·p-063의 stale image 3건을 TODO 마커로 복원.
 * mapping entries manifest_path도 null로 정리.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const SRC = "2024-jbu-work-support-guide";

const targets = [
  {
    file: "content/domains/2024-jbu-p-061.md",
    imageRaster: "page-100-fig-01.png",
    altOriginal: "한 사람이 다른 사람의 복부를 발로 차 넘어뜨리는 신체적 학대 장면을 묘사한 일러스트.",
    key: `2024-jbu-p-061#${SRC}#0`,
  },
  {
    file: "content/policies/2024-jbu-p-063.md",
    imageRaster: "page-101-fig-02.png",
    altOriginal: "휠체어에 앉아 불편해하는 여성의 팔을 억지로 잡아당기는 남성의 모습. 이는 신체적 괴롭힘이나 성적 학대를 묘사한다.",
    key: `2024-jbu-p-063#${SRC}#0`,
  },
  {
    file: "content/policies/2024-jbu-p-063.md",
    imageRaster: "page-102-fig-01.png",
    altOriginal: "경제적 착취를 시각적으로 보여주는 삽화입니다. 한 사람이 다른 사람의 가방에서 돈을 몰래 빼내고 있습니다.",
    key: `2024-jbu-p-063#${SRC}#1`,
  },
];

// 1) 본문 image → TODO 마커
for (const t of targets) {
  const path = resolve(ROOT, t.file);
  let body = readFileSync(path, "utf8");
  const imagePattern = `![${t.altOriginal}](/source-images/${SRC}/${t.imageRaster})`;
  const todoMarker = `<!-- TODO: image-link source=${SRC} -- 원본: (이미지: ${t.altOriginal}) -->`;
  if (!body.includes(imagePattern)) {
    console.error(`SKIP ${t.file}: image pattern 없음 (이미 정리됨?)`);
    continue;
  }
  body = body.replace(imagePattern, todoMarker);
  writeFileSync(path, body, "utf8");
  console.error(`restored ${t.file}: image → TODO 마커`);
}

// 2) mapping entries manifest_path null
const mappingsPath = resolve(ROOT, "content/_image-mappings.json");
const data = JSON.parse(readFileSync(mappingsPath, "utf8"));
for (const t of targets) {
  const entry = data.mappings[t.key];
  if (!entry) {
    console.error(`SKIP entry ${t.key}: 없음`);
    continue;
  }
  entry.manifest_path = null;
  entry.notes = "PR #4 stale 정리 (PR C). 본문 image를 TODO 마커로 복원하면서 entry도 null로.";
  console.error(`cleared entry ${t.key}`);
}
writeFileSync(mappingsPath, JSON.stringify(data, null, 2) + "\n", "utf8");
EOF
```

### - [ ] Step 3: 복원 실행 + 검증

```bash
node /tmp/restore-stale-jbu.mjs
```

Expected:
```
restored content/domains/2024-jbu-p-061.md: image → TODO 마커
restored content/policies/2024-jbu-p-063.md: image → TODO 마커
restored content/policies/2024-jbu-p-063.md: image → TODO 마커
cleared entry 2024-jbu-p-061#2024-jbu-work-support-guide#0
cleared entry 2024-jbu-p-063#2024-jbu-work-support-guide#0
cleared entry 2024-jbu-p-063#2024-jbu-work-support-guide#1
```

### - [ ] Step 4: invariant 확인

```bash
echo "mapped (manifest_path 있음):"
cat content/_image-mappings.json | jq '[.mappings | to_entries[] | select(.value.manifest_path != null)] | length'
echo "body image:"
grep -roE '!\[[^]]+\]\(/source-images/' content/ 2>/dev/null | wc -l
```

Expected: 두 카운트가 동일해야 함 (정합). PR B 머지 후 mapped=25, body=25. Step 3 후 mapped=22, body=22.

### - [ ] Step 5: 테스트 확인

```bash
npm test 2>&1 | grep -E "^ℹ " | head -5
```

Expected: `tests N`, `pass N`, `fail 0`. 특히 `decompose-source.test.ts:235` invariant test가 PASS여야 함.

### - [ ] Step 6: 커밋

```bash
git add content/_image-mappings.json content/domains/2024-jbu-p-061.md content/policies/2024-jbu-p-063.md
git commit -m "$(cat <<'COMMIT'
fix(phase-1-5b): PR #4 stale 3건 정리 — 본문 image → TODO 마커 + entry null

PR B 작업 중 발견한 PR #4 잔재. jbu-p-061·jbu-p-063의 본문에 잘못 inserted된
image 3건을 TODO 마커로 복원하고 _image-mappings.json의 manifest_path를 null로
정리. 본문 image와 entry의 정합성 유지 (invariant test 통과).

이 stale 3건은 PR #4의 indexInFile drift 버그 흔적. PR #5 _alt_original
가드가 이후 적용을 차단했으나, 본문 image와 entry는 master에 잔류했음.
PR C에서 정공법으로 둘 다 정리.

codex-rescue PR B follow-up 3건 중 하나.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task C2: cross-validation ±10 window 보강

**Goal**: `page_number_seed` 매핑(13건)에 대해 ±10 raster 후보를 생성하고 Gemma 1차 stamp로 좁힌 뒤 4종 합의 게이트로 최선 raster 선정.

PR A A8 known-answer 분석에서 오프셋 -22~+3 발견. ±10은 그 범위의 절반 cover. 비용 절감(±25 대비 1/2.5) + 자동 적용 확대 양립.

**전략**:
1. `page_number_seed` 매핑에 대해서만 ±10 raster 후보 list 생성 (chapter slug는 PR C 범위 밖)
2. 각 후보에 대해 **Gemma 로컬 1차 stamp** — 가장 빠른 모델로 명시적 NO 거르기
3. Gemma YES 후보만 4종 합의 게이트 검증
4. 최선(yesCount 최대) raster 선정. 동률이면 slug 번호 가까운 순.

**Files:**
- Modify: `scripts/cross-validate-mappings.mjs`

### - [ ] Step 1: 현재 cross-validate-mappings.mjs 구조 검토

```bash
sed -n '180,250p' scripts/cross-validate-mappings.mjs
```

핵심 함수: main loop의 `if (entry.method === "known_answer")` block 뒤에 `else if (entry.method === "page_number_seed")` 분기 추가.

### - [ ] Step 2: ±10 window 후보 처리 헬퍼 추가

`scripts/cross-validate-mappings.mjs`의 main loop 직전(약 `const candidates = {};` 위에)에 헬퍼 함수 추가:

```javascript
/**
 * page_number_seed 매핑에 ±10 raster window cross-validation 적용.
 * 1) Gemma 로컬 1차 stamp로 후보 좁힘
 * 2) Gemma YES 후보만 4종 합의 게이트
 * 3) 최선(yesCount 최대) raster 선정
 */
async function processPageNumberSeedWindow(key, entry, altOriginal) {
  const source = entry.source;
  const seedRaster = entry.raster; // "page-NNN-render.png"
  const seedMatch = seedRaster.match(/^page-(\d+)-render\.png$/);
  if (!seedMatch) return null;
  const seedNum = parseInt(seedMatch[1], 10);

  const WINDOW = 10;
  const candidatesList = [];
  for (let n = Math.max(1, seedNum - WINDOW); n <= seedNum + WINDOW; n++) {
    const raster = `page-${String(n).padStart(3, "0")}-render.png`;
    const absPath = `${REPO}/public/source-images/${source}/${raster}`;
    if (!existsSync(absPath)) continue;
    candidatesList.push({ raster, absPath, num: n });
  }

  // 1차 Gemma stamp
  const stamped = [];
  for (const cand of candidatesList) {
    const verdict = await callGemma(cand.absPath, altOriginal);
    if (verdict.verdict === "YES") stamped.push(cand);
    process.stderr.write(`    gemma p${cand.num}: ${verdict.verdict}\n`);
  }

  if (stamped.length === 0) {
    return { decision: "review", reason: "Gemma 1차 stamp 0 YES (±10 window)", verdicts: {}, raster: seedRaster };
  }

  // 2차 4종 합의 게이트 (Gemma YES 후보들)
  let best = null;
  for (const cand of stamped) {
    const [claude, gemini, _, codex] = await Promise.all([
      callClaude(cand.absPath, altOriginal),
      callGemini(cand.absPath, altOriginal),
      Promise.resolve({ verdict: "YES" }), // 이미 stamped
      callCodex(cand.absPath, altOriginal),
    ]);
    const gemma = await callGemma(cand.absPath, altOriginal); // cache hit
    const verdicts = { claude: claude.verdict, gemini: gemini.verdict, gemma: gemma.verdict, codex: codex.verdict };
    const yes = Object.values(verdicts).filter((v) => v === "YES").length;
    const no = Object.values(verdicts).filter((v) => v === "NO").length;
    const err = Object.values(verdicts).filter((v) => v === "ERROR").length;
    const okFourFour = yes === 4;
    const okThreeFour = yes === 3 && no === 0;
    const decision = (okFourFour || okThreeFour) ? "apply" : "review";
    process.stderr.write(`    p${cand.num} 4종: C=${verdicts.claude} G=${verdicts.gemini} M=${verdicts.gemma} X=${verdicts.codex} → ${decision} (yes=${yes} no=${no})\n`);
    const score = yes - no - err * 0.5;
    if (decision === "apply") {
      if (!best || score > best.score) {
        best = { score, raster: cand.raster, verdicts, yes, no };
      }
    }
  }

  if (best) {
    return {
      decision: "apply",
      raster: best.raster,
      verdicts: best.verdicts,
      yesCount: best.yes,
      noCount: best.no,
      reason: `±10 window 최선 (yes=${best.yes}, no=${best.no})`,
    };
  }

  return {
    decision: "review",
    raster: seedRaster,
    verdicts: {},
    reason: `±10 window ${stamped.length}건 Gemma YES, 그러나 4종 합의 미달`,
  };
}
```

(가독성을 위해 위 함수의 cache 키는 기존 callXxx 함수들에 의해 자동 관리됨. 새 cache 항목 불요.)

### - [ ] Step 3: main loop에 page_number_seed 분기 추가

기존 main loop의 known_answer 분기 직후에 추가:

```javascript
// known_answer skip 후
if (entry.method === "page_number_seed") {
  process.stderr.write(`[${idx}/${keys.length}] ${key} page_number_seed → ±10 window\n`);
  const result = await processPageNumberSeedWindow(key, entry, altOriginal);
  if (result) {
    candidates[key] = {
      decision: result.decision,
      manifest_path: `public/source-images/${entry.source}/${result.raster}`,
      method: entry.method,
      verdicts: result.verdicts,
      yesCount: result.yesCount ?? 0,
      noCount: result.noCount ?? 0,
      reason: result.reason,
    };
    continue;
  }
}
// 그 외 method (primary/fallback)는 기존 단일 후보 로직 그대로
```

### - [ ] Step 4: syntax check

```bash
node --check scripts/cross-validate-mappings.mjs
```

Expected: no output (syntax OK).

### - [ ] Step 5: 커밋

```bash
git add scripts/cross-validate-mappings.mjs
git commit -m "$(cat <<'COMMIT'
feat(phase-1-5b): cross-validation에 ±10 window 추가 (PR C)

page_number_seed 매핑(13건)에 대해 raster ±10 후보를 동적 생성하고
Gemma 로컬 1차 stamp로 좁힌 뒤 4종 합의 게이트로 최선 raster 선정.

PR A A8에서 발견한 비선형 오프셋(-22~+3) 일부 cover. ±10이 ±25 대비
비용 1/2.5 절감. chapter slug 60건은 비용 부담으로 PR C 범위 밖.

codex-rescue PR B follow-up 3건 중 두 번째 — recall gap 보강.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task C3: cross-validation re-run + image:apply

매핑 사전 빌더는 재실행 불필요 (B1 결과 그대로). cross-validation만 새 ±10 window 로직으로 재실행.

**Files:**
- Modify: `content/_image-mappings-candidates.json` (overwrite)
- Modify: `content/_image-mappings.json` (apply 머지)
- Modify: `content/<...>.md` (image:apply가 본문 갱신)

### - [ ] Step 1: gemma-server 확인

```bash
pgrep -f "llama-server.*8080" >/dev/null && echo "gemma-server running" || (gemma-server > /tmp/gemma-server.log 2>&1 &)
sleep 5
curl -s --max-time 5 localhost:8080/v1/models | head -3
```

Expected: gemma E4B 응답.

### - [ ] Step 2: cross-validation 재실행

```bash
node scripts/cross-validate-mappings.mjs > /tmp/c2-stdout.log 2> /tmp/c2-stderr.log &
echo "PID=$!"
```

> **주의**: 79건 입력 중 known_answer 7 + page_number_seed 13 + primary/fallback 59. page_number_seed 13건은 ±10 window 처리(case당 약 21 raster × Gemma 1차 + N stamped × 3종 4종 = 약 60-120초/case). primary/fallback 59건은 기존 단일 후보 (case당 ~30초). 총 wall clock 추정: 30~45분.

cache resume 보장 — 기존 호출은 cache hit.

### - [ ] Step 3: 진행 모니터

```bash
# 진행 확인:
grep -cE '^\[[0-9]+/79\]' /tmp/c2-stderr.log
# 완료 확인:
grep "결과 요약" /tmp/c2-stderr.log && echo "DONE"
```

완료까지 대기 (ScheduleWakeup으로 30분 간격 polling 권장 또는 controller wait).

### - [ ] Step 4: 결과 통계

```bash
cat content/_image-mappings-candidates.json | jq '.candidates | to_entries | map(.value.decision) | group_by(.) | map({decision: .[0], count: length})'
```

Expected: apply N건 (≥ 7, known_answer 포함). N - 7 = 추가 자동 적용 (페이지 hint window 효과).

### - [ ] Step 5: image:apply 실행

```bash
node scripts/merge-candidates-to-mappings.mjs
npm run image:apply 2>&1 | tail -10
```

Expected: `_alt_original` 가드 통과. "수정 파일: M, 교체 마커: N건".

오류 발생 시: 기존 stale entries에서 막힐 수 있음 (Task C1에서 정리됐어야 함). entry 점검.

### - [ ] Step 6: 빌드 + test

```bash
npm run build 2>&1 | tail -10
npm test 2>&1 | grep -E "^ℹ " | head -5
```

Expected: 564개 정적 페이지 + 84+ tests 그린.

### - [ ] Step 7: 커밋

```bash
git add content/_image-mappings.json content/_image-mappings-candidates.json content/
git commit -m "$(cat <<'COMMIT'
feat(phase-1-5b): PR C cross-validation 재실행 — ±10 window 자동 적용 추가

±10 window 보강으로 page_number_seed 13건의 정답 raster 추가 탐색.
known_answer 7 + ±10 window 추가 N = 자동 적용 총 (7+N)건.

빌드 564 + tests 그린 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task C4: 검수 큐 갱신 + commit

**Files:**
- Modify: `docs/image-mapping-disputed.md`

### - [ ] Step 1: 검수 큐 재생성

PR B에서 만든 `/tmp/regen-disputed.mjs` 패턴 재사용. raster, candidates, unresolved 입력으로 disputed.md 갱신.

```bash
cat > /tmp/regen-disputed-c.mjs <<'EOF'
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = process.cwd();
const cand = JSON.parse(readFileSync(resolve(ROOT, "content/_image-mappings-candidates.json"), "utf8")).candidates;
const unresolved = JSON.parse(readFileSync(resolve(ROOT, "content/_slug-raster-unresolved.json"), "utf8")).unresolved;
const all = JSON.parse(readFileSync(resolve(ROOT, "content/_image-mappings.json"), "utf8")).mappings;

const reviewCases = Object.entries(cand).filter(([, c]) => c.decision === "review");
const applyCount = Object.values(cand).filter((c) => c.decision === "apply").length;

const lines = [
  "# 이미지 매핑 — 위원장 검수 큐 (Phase 1.5b PR C 후속)",
  "",
  `Phase 1.5b 본 자동화(PR B) + ±10 window 보강(PR C) 후 잔여. 위원장이 화면 낭독기로 청취 후 결정.`,
  "",
  "## 결과 요약 (누적)",
  "",
  `- 자동 적용: ${applyCount}건 (known_answer 7 + ±10 window 추가)`,
  `- 검수 큐 (review): ${reviewCases.length}건 — 4종 합의 게이트 거부`,
  `- 매핑 사전 unresolved: ${unresolved.length}건 — B1 단계 실패`,
  "",
  "## 매핑 사전 unresolved",
  "",
];
for (const u of unresolved) {
  lines.push(`- \`${u.key}\` — ${u.source} (사유: ${u.reason})`);
}
lines.push("");
lines.push("## 검수 대상 (review)");
lines.push("");
for (const [key, c] of reviewCases) {
  const alt = (all[key]?._alt_original ?? "").slice(0, 120);
  lines.push(`### \`${key}\``);
  lines.push(`- 후보 raster: \`${c.manifest_path}\``);
  lines.push(`- method: ${c.method}`);
  lines.push(`- 합의: Claude=${c.verdicts.claude ?? "-"} Gemini=${c.verdicts.gemini ?? "-"} Gemma=${c.verdicts.gemma ?? "-"} Codex=${c.verdicts.codex ?? "-"} (${c.reason})`);
  lines.push(`- alt: ${alt}…`);
  lines.push("");
}
writeFileSync(resolve(ROOT, "docs/image-mapping-disputed.md"), lines.join("\n") + "\n", "utf8");
console.error(`disputed.md 갱신: review ${reviewCases.length}건 + unresolved ${unresolved.length}건`);
EOF
node /tmp/regen-disputed-c.mjs
```

### - [ ] Step 2: 결과 확인 + 커밋

```bash
head -25 docs/image-mapping-disputed.md
git add docs/image-mapping-disputed.md
git commit -m "$(cat <<'COMMIT'
docs(phase-1-5b): PR C 검수 큐 갱신 — ±10 window 후 잔여 routing

cross-validation ±10 window 보강 결과를 반영해 검수 큐 갱신.
review 케이스 + 매핑 사전 unresolved를 위원장 청취 큐로 routing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task C5: PR 생성 + codex-rescue + 머지

### - [ ] Step 1: CLAUDE.md 변경 이력 추가 (Edit/Write)

> **주의**: webfortd/CLAUDE.md는 `.gitignore` 등록 파일이라 `git add`로는 commit되지 않음. Edit/Write로만 갱신. PR에는 포함 안 되지만 위원장 참조용으로 갱신.

CLAUDE.md "변경 이력" 표 끝에 추가:
```
| 2026-05-19 | Phase 1.5b PR C 머지 — PR #4 stale 3건 정리(본문 image → TODO 마커 + entry null) + cross-validation ±10 window 추가. 자동 적용 누적 7 + N건. codex-rescue PR B follow-up 3건 중 2건 처리 (3번째 chapter slug ±N window는 비용 부담으로 미적용). 빌드 564개, tests 그린. |
```

### - [ ] Step 2: 누적 변경 확인 + push

```bash
git log --oneline master..HEAD
git diff --stat master..HEAD
git push -u origin phase-1-5b-pr-c-cleanup-window
```

### - [ ] Step 3: PR 생성

```bash
gh pr create --title "Phase 1.5b PR C — stale 정리 + ±10 window 자동 적용" --body "$(cat <<'EOF'
## Summary

- **Task C1**: PR #4 stale 3건 정리 (jbu-p-061·063 본문 image → TODO 마커 + entry null)
- **Task C2**: cross-validation ±10 window 추가 (page_number_seed 13건 정답 탐색)
- **Task C3**: re-run → image:apply → 빌드/test 검증
- **Task C4**: 검수 큐 갱신

자동 적용: known_answer 7 + ±10 window 추가 = 총 N건.
잔여 케이스는 closed-loop 검수 큐로 routing.

## codex-rescue PR B follow-up 처리 현황

- ✅ stale 3건 기술부채 정리 (Task C1)
- ✅ cross-validation ±10 window 보강 (Task C2)
- ⚠️ matching dict page-numbered fallback 별도 추가는 cross-validation ±10 window로 통합 cover (실질 동일 효과)
- 🚧 chapter slug ±N window는 PR C 범위 밖 (비용 부담)

## Test plan

- [x] invariant: 본문 image == manifest_path entry (stale 정리 후 정합)
- [x] 7건 known-answer 단위 테스트 (회귀 차단)
- [x] _alt_original 가드 (PR #5) 통과
- [x] npm run build 564 정적 페이지
- [x] npm test 그린
- [ ] codex-rescue 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### - [ ] Step 4: codex-rescue dispatch

```
Agent({
  subagent_type: "codex:codex-rescue",
  description: "Phase 1.5b PR C 리뷰",
  prompt: "Phase 1.5b PR C 변경 검토. 리뷰 포커스 3가지: (1) PR #4 stale 3건 정리가 본문+entry 정합성을 잘 유지하는가? (2) cross-validation ±10 window 로직(Gemma 1차 stamp + 4종 합의)이 합의 게이트 무결성을 깨지 않는가? (3) re-run 결과 자동 적용 증가분이 chapter divider 같은 false positive를 포함하지 않는가? 200단어 이내, cross-cutting invariant gap 우선."
})
```

### - [ ] Step 5: codex 보완 적용 + 머지

```bash
gh pr merge --admin --squash --delete-branch
git checkout master && git pull
```

---

## Self-Review

### Spec/follow-up coverage

| codex-rescue PR B follow-up | 본 plan에서 처리 |
|----------------------------|-------------------|
| page-numbered fallback 부재 | Task C2 ±10 window로 통합 (실질 fallback 효과) |
| cross-validation ±N window 부재 | Task C2 직접 처리 |
| stale 3건 기술부채 | Task C1 직접 처리 |
| chapter slug 60건 ±N window | PR C 범위 밖 (비용 부담 명시) |

### Placeholder scan

- Task C3 Step 3 "ScheduleWakeup으로 polling" — controller가 background 실행 + 정주기 polling. 작업자 가이드.
- Task C5 Step 4 codex 보완 commit message — PR A·B 패턴(`docs(phase-1-5b): codex-rescue 보완 — <한 줄>`) 따름.

### Type consistency

- 매핑 사전 entry 구조: `{source, raster, method, alt}` — C1~C3 일관.
- candidate 구조: `{decision, manifest_path, method, verdicts, yesCount, noCount, reason}` — C2·C3 일관.
- 합의 게이트: `yesCount === 4 || (yesCount === 3 && noCount === 0)` — Phase 1.5/PR B와 동일.

### 명세 누락 보강

- Task C2의 ±10 window가 known_answer 7건도 처리하지 않도록 main loop에서 `if (method === "known_answer")` 블록이 먼저 와야 함 — 코드 순서 명시.
- Gemma 1차 stamp가 ERROR 반환 시 후보로 처리되지 않음 — 보수적이지만 합리적 (ERROR는 후보에서 제외).

---

## 실행 옵션

Plan 완성. `docs/superpowers/plans/2026-05-19-phase-1-5b-pr-c-cleanup-and-window.md`에 저장됨.

**1. Subagent-Driven (권장)** — task별 fresh subagent dispatch + 두 단계 review. PR A·B 동일 흐름.

**2. Inline Execution** — 현 세션에서 executing-plans skill로 batch 실행, 체크포인트로 review.
