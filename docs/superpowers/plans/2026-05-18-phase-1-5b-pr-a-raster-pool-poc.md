# Phase 1.5b PR A — raster pool 보강 PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 86건 unmapped 이미지 자동화의 raster pool 보강 가능성을 검증하기 위해 4종 추출 도구를 `2023-hr-guide.pdf` 한 권에 적용해 raster 개수·페이지 분포·중복률·alt 매칭 시뮬레이션·PDF outline 추출 가능성을 측정하고, 채택 도구와 chapter slug page-range 부여 방식을 결정한다.

**Architecture:** 단일 PDF에 대해 baseline(PyMuPDF `get_images`)·pdftocairo·PyMuPDF 페이지 렌더·docparse·opendataloader-pdf를 병렬 적용. 결과 raster를 해시 비교로 union·중복 분석. 60건 unmapped 중 페이지 hint 있는 10건 샘플에 대해 3종 모델(Gemini·Gemma·Claude) cross-validation 시뮬레이션. PDF outline은 PyMuPDF `get_toc()`로 추출 가능성 확인.

**Tech Stack:** Python 3 (PyMuPDF/fitz), pdftocairo·pdfimages (poppler/Homebrew), Node.js (tsx) for 분석 스크립트, Anthropic Claude API, Gemini CLI, llama.cpp Gemma vision. 모든 PoC 산출물은 `/tmp/image-match-poc/`에 위치(git ignored), 결정 사항만 spec에 반영.

---

## Files

### Create (git tracked)
- `docs/superpowers/plans/2026-05-18-phase-1-5b-pr-a-raster-pool-poc.md` — 본 plan 자체

### Create (PoC 산출물, git ignored)
- `/tmp/image-match-poc/extract-pdftocairo.sh`
- `/tmp/image-match-poc/extract-pymupdf-pages.py`
- `/tmp/image-match-poc/extract-docparse.sh`
- `/tmp/image-match-poc/extract-opendataloader.sh`
- `/tmp/image-match-poc/extract-outline.py`
- `/tmp/image-match-poc/compare-rasters.mjs`
- `/tmp/image-match-poc/sample-simulate.mjs`
- `/tmp/image-match-poc/raster-tools-comparison.md`
- `/tmp/image-match-poc/rasters/{pdftocairo,pymupdf-pages,docparse,opendataloader}/` — 도구별 raster 디렉터리

### Modify
- `docs/superpowers/specs/2026-05-18-phase-1-5b-86-image-automation-design.md` — §3.1 마지막에 "PoC 결과" 절 추가 (Task A8에서)

### Reuse (변경 없음)
- `scripts/extract-pdf-images.py` — baseline PyMuPDF `get_images(full=True)` 모드. 현재 22개 raster 추출
- `data/source-pdf/2023-hr-guide.pdf` — PoC 대상 PDF
- `public/source-images/2023-hr-guide/` — baseline raster (22개)
- `content/_image-mappings.json` — TODO key 목록 참조용
- `/tmp/image-match-poc/cross-validate.mjs` — Phase 1.5 cross-validation 패턴 참조용
- `/tmp/image-match-poc/auto-mapping.mjs` — Phase 1.5 자동화 패턴 참조용

---

## Task A1: 작업 브랜치 + pdftocairo 설치

**Files:**
- None (환경 셋업만)

- [ ] **Step 1: 작업 브랜치 생성**

```bash
git checkout master && git pull
git checkout -b phase-1-5b-raster-pool-poc
```

Expected: `Switched to a new branch 'phase-1-5b-raster-pool-poc'`

- [ ] **Step 2: pdftocairo·pdfimages 설치 확인**

```bash
which pdftocairo pdfimages || brew install poppler
which pdftocairo && which pdfimages
```

Expected: `/opt/homebrew/bin/pdftocairo` 와 `/opt/homebrew/bin/pdfimages` 양쪽 경로 출력.

- [ ] **Step 3: PoC 작업 디렉터리 준비**

```bash
mkdir -p /tmp/image-match-poc/rasters/{pdftocairo,pymupdf-pages,docparse,opendataloader}
ls -la /tmp/image-match-poc/
```

Expected: `rasters` 디렉터리에 네 개 하위 디렉터리 생성됨.

---

## Task A2: pdftocairo·pdfimages 추출

**Files:**
- Create: `/tmp/image-match-poc/extract-pdftocairo.sh`

- [ ] **Step 1: 추출 스크립트 작성**

```bash
cat > /tmp/image-match-poc/extract-pdftocairo.sh <<'EOF'
#!/bin/bash
set -e
PDF="${1:-data/source-pdf/2023 장애인교원 인사관리 안내서.pdf}"
OUT="/tmp/image-match-poc/rasters/pdftocairo"
mkdir -p "$OUT"
rm -f "$OUT"/*.png "$OUT"/*.jpg 2>/dev/null
# 임베디드 이미지 추출 (벡터 그래픽은 raster화 안 됨, baseline과 유사)
pdfimages -png "$PDF" "$OUT/embedded"
echo "pdfimages 추출 완료: $(ls $OUT | wc -l)건"
EOF
chmod +x /tmp/image-match-poc/extract-pdftocairo.sh
```

- [ ] **Step 2: 실행**

```bash
/tmp/image-match-poc/extract-pdftocairo.sh "data/source-pdf/2023 장애인교원 인사관리 안내서.pdf"
ls /tmp/image-match-poc/rasters/pdftocairo/ | wc -l
```

Expected: 추출 raster 개수 출력. baseline 22 대비 비교.

---

## Task A3: PyMuPDF 페이지 전체 렌더 추출

**Files:**
- Create: `/tmp/image-match-poc/extract-pymupdf-pages.py`

벡터 그래픽 일러스트·플로차트가 baseline에서 누락된 것이 핵심 원인 가설. 페이지 전체를 raster화하면 벡터 그래픽도 캡처됨.

- [ ] **Step 1: 추출 스크립트 작성**

```python
cat > /tmp/image-match-poc/extract-pymupdf-pages.py <<'EOF'
#!/usr/bin/env python3
"""PyMuPDF 페이지 전체 렌더 추출. baseline의 get_images 모드는 벡터 그래픽을 놓치므로 페이지 raster로 보완."""
import fitz
import sys
from pathlib import Path

pdf_path = sys.argv[1] if len(sys.argv) > 1 else "data/source-pdf/2023 장애인교원 인사관리 안내서.pdf"
out_dir = Path("/tmp/image-match-poc/rasters/pymupdf-pages")
out_dir.mkdir(parents=True, exist_ok=True)
for f in out_dir.glob("*.png"):
    f.unlink()

doc = fitz.open(pdf_path)
count = 0
for page_num in range(len(doc)):
    page = doc[page_num]
    pix = page.get_pixmap(dpi=150)  # 150 dpi라 적당한 raster 크기
    out = out_dir / f"page-{page_num+1:03d}.png"
    pix.save(out)
    count += 1

print(f"PyMuPDF pages 추출 완료: {count}건")
EOF
chmod +x /tmp/image-match-poc/extract-pymupdf-pages.py
```

- [ ] **Step 2: 실행**

```bash
python3 /tmp/image-match-poc/extract-pymupdf-pages.py "data/source-pdf/2023 장애인교원 인사관리 안내서.pdf"
ls /tmp/image-match-poc/rasters/pymupdf-pages/ | wc -l
```

Expected: PDF 전체 페이지 수만큼 raster 추출. 예: 200페이지 PDF → 200개 raster.

---

## Task A4: docparse 추출 시도

**Files:**
- Create: `/tmp/image-match-poc/extract-docparse.sh`

docparse는 layout-aware crop을 지원하는지가 핵심. CLI 옵션 확인 후 시도.

- [ ] **Step 1: docparse CLI 옵션 확인**

```bash
ls ~/Mac-Projects/Converters/ | grep -i docparse
cat ~/.claude/skills/docparse/SKILL.md 2>/dev/null | grep -A 5 "image\|raster\|crop" || \
  cat ~/Mac-Projects/Converters/docparse/SKILL.md 2>/dev/null | grep -A 5 "image\|raster\|crop" || \
  echo "docparse SKILL.md not found at expected paths"
```

목적: docparse가 PDF→이미지 region crop을 지원하는지 확인.

- [ ] **Step 2: 지원 시 추출 스크립트 작성**

docparse가 image extraction 지원 시:

```bash
cat > /tmp/image-match-poc/extract-docparse.sh <<'EOF'
#!/bin/bash
set -e
PDF="${1:-data/source-pdf/2023 장애인교원 인사관리 안내서.pdf}"
OUT="/tmp/image-match-poc/rasters/docparse"
mkdir -p "$OUT"
# docparse CLI 명령 — Step 1 확인 결과 따라 채움
# 예: docparse --input "$PDF" --extract-images --output-dir "$OUT"
echo "docparse CLI 명령 입력 필요 (Step 1 결과 확인 후)"
EOF
chmod +x /tmp/image-match-poc/extract-docparse.sh
```

docparse가 image extraction 미지원 시: 이 task 결과를 "skip — docparse는 텍스트/구조 파싱 전용, raster region crop 미지원"로 기록하고 Task A5로 넘어감.

- [ ] **Step 3: 실행 또는 skip 결정 기록**

```bash
# 실행 가능한 경우
/tmp/image-match-poc/extract-docparse.sh

# skip 결정 시
echo "docparse skip — Step 1에서 image extraction 옵션 없음 확인" > /tmp/image-match-poc/rasters/docparse/SKIP.txt
```

---

## Task A5: opendataloader-pdf 추출 시도

**Files:**
- Create: `/tmp/image-match-poc/extract-opendataloader.sh`

- [ ] **Step 1: opendataloader-pdf jar 위치 확인**

```bash
which java && java -version
find ~/Mac-Projects ~/Downloads /usr/local /opt -name "opendataloader*.jar" -type f 2>/dev/null | head -3
```

Expected: Java 25 (Temurin) 확인됨. opendataloader jar 경로 출력.

jar 없으면 Maven Central에서 다운로드:

```bash
# 필요 시
curl -L -o /tmp/opendataloader-pdf.jar https://repo1.maven.org/maven2/io/github/<...>/opendataloader-pdf/<version>/opendataloader-pdf-<version>.jar
```

(정확한 좌표는 GitHub 릴리즈 페이지 확인. Step 1에서 jar 미발견 시 사용자에 확인 요청)

- [ ] **Step 2: 추출 스크립트 작성**

```bash
cat > /tmp/image-match-poc/extract-opendataloader.sh <<'EOF'
#!/bin/bash
set -e
PDF="${1:-data/source-pdf/2023 장애인교원 인사관리 안내서.pdf}"
OUT="/tmp/image-match-poc/rasters/opendataloader"
mkdir -p "$OUT"
JAR="${OPENDATALOADER_JAR:-$(find ~ -name 'opendataloader*.jar' 2>/dev/null | head -1)}"
if [ -z "$JAR" ]; then
  echo "opendataloader jar not found — skip"
  exit 0
fi
java -jar "$JAR" --input "$PDF" --output "$OUT" --extract-images 2>&1
echo "opendataloader 추출 완료: $(ls $OUT | wc -l)건"
EOF
chmod +x /tmp/image-match-poc/extract-opendataloader.sh
```

- [ ] **Step 3: 실행**

```bash
/tmp/image-match-poc/extract-opendataloader.sh
ls /tmp/image-match-poc/rasters/opendataloader/ | wc -l
```

미사용 시 skip 처리.

---

## Task A6: PDF outline 추출 PoC

**Files:**
- Create: `/tmp/image-match-poc/extract-outline.py`

60건 chapter slug에 page range 부여 가능성 — 핵심 prereq.

- [ ] **Step 1: outline 추출 스크립트**

```python
cat > /tmp/image-match-poc/extract-outline.py <<'EOF'
#!/usr/bin/env python3
"""PDF outline(TOC)을 추출해 chapter ↔ page 매핑 가능성 검증."""
import fitz
import sys
import json

pdf_path = sys.argv[1] if len(sys.argv) > 1 else "data/source-pdf/2023 장애인교원 인사관리 안내서.pdf"
doc = fitz.open(pdf_path)
toc = doc.get_toc()
print(json.dumps(toc, ensure_ascii=False, indent=2))
EOF
chmod +x /tmp/image-match-poc/extract-outline.py
```

- [ ] **Step 2: 4개 PDF 모두 실행**

```bash
for pdf in data/source-pdf/*.pdf; do
  echo "=== $(basename "$pdf") ==="
  python3 /tmp/image-match-poc/extract-outline.py "$pdf"
  echo ""
done | tee /tmp/image-match-poc/outlines.txt | head -80
```

Expected: 각 PDF의 `[level, title, page]` 항목 출력. 챕터 시작 페이지가 추출되면 success.

- [ ] **Step 3: chapter slug ↔ outline 매칭 검증**

`content/**/*.md`에서 chapter slug 일부(예: `2023-hr-1-2`, `2023-hr-2-2`)의 frontmatter `title`을 outline 항목과 매칭 시도:

```bash
# 샘플 chapter slug의 title 확인
grep -h "^title:" content/domains/2023-hr-1-2.md content/domains/2023-hr-2-2.md content/policies/2023-hr-2-3.md
```

outline의 title과 chapter slug의 frontmatter title이 일치하면 매핑 가능. 그러면 PR B에서 60건 chapter slug에 page range 부여 가능.

매칭 불일치 시: chapter slug 60건은 closed-loop 직행. 보고서에 기록.

---

## Task A7: 도구별 raster 비교 분석

**Files:**
- Create: `/tmp/image-match-poc/compare-rasters.mjs`

- [ ] **Step 1: 비교 스크립트 작성**

```javascript
cat > /tmp/image-match-poc/compare-rasters.mjs <<'EOF'
#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/hunyongkim/Mac-Projects/webfortd';
const TOOLS = {
  baseline: path.join(ROOT, 'public/source-images/2023-hr-guide'),
  pdftocairo: '/tmp/image-match-poc/rasters/pdftocairo',
  'pymupdf-pages': '/tmp/image-match-poc/rasters/pymupdf-pages',
  docparse: '/tmp/image-match-poc/rasters/docparse',
  opendataloader: '/tmp/image-match-poc/rasters/opendataloader',
};

async function listImages(dir) {
  try {
    const files = await readdir(dir);
    return files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).sort();
  } catch {
    return [];
  }
}

async function hashFile(filepath) {
  try {
    const buf = await readFile(filepath);
    const s = await stat(filepath);
    return { md5: createHash('md5').update(buf).digest('hex'), size: s.size };
  } catch {
    return null;
  }
}

const results = {};
for (const [tool, dir] of Object.entries(TOOLS)) {
  const files = await listImages(dir);
  const meta = [];
  for (const f of files) {
    const h = await hashFile(path.join(dir, f));
    if (h) meta.push({ file: f, ...h });
  }
  results[tool] = { dir, count: files.length, files: meta };
  console.log(`${tool}: ${files.length} files`);
}

// 도구 간 중복 (동일 해시) 분석
const hashIndex = new Map();
for (const [tool, data] of Object.entries(results)) {
  for (const { file, md5 } of data.files) {
    if (!hashIndex.has(md5)) hashIndex.set(md5, []);
    hashIndex.get(md5).push(`${tool}/${file}`);
  }
}
const duplicates = [...hashIndex.entries()].filter(([_, files]) => files.length > 1);
console.log(`\n도구 간 동일 해시 raster: ${duplicates.length}건`);

await writeFile('/tmp/image-match-poc/raster-comparison.json', JSON.stringify({
  results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { count: v.count, files: v.files.map(f => f.file) }])),
  duplicates: duplicates.map(([h, files]) => ({ hash: h, files })),
}, null, 2));

console.log('\n저장: /tmp/image-match-poc/raster-comparison.json');
EOF
```

- [ ] **Step 2: 실행**

```bash
node /tmp/image-match-poc/compare-rasters.mjs
cat /tmp/image-match-poc/raster-comparison.json | head -30
```

Expected:
- 각 도구별 raster 개수
- 도구 간 중복 raster 건수

---

## Task A8: alt 매칭 시뮬레이션 (10건 샘플)

**Files:**
- Create: `/tmp/image-match-poc/sample-simulate.mjs`

`docs/image-mapping-disputed.md`에서 페이지 hint 있는 케이스 10건 샘플 선정. 채택 후보 도구의 raster pool로 3종 cross-validation 시뮬레이션.

- [ ] **Step 1: 샘플 10건 선정**

```bash
grep -E "페이지 hint: [0-9]+" docs/image-mapping-disputed.md | head -10
```

Expected: 페이지 hint 있는 케이스 10건 (staff-p-149의 4건 + jbu/hr 케이스 6건).

샘플 케이스 key 목록을 `/tmp/image-match-poc/sample-keys.txt`에 저장:

```bash
cat > /tmp/image-match-poc/sample-keys.txt <<'EOF'
2024-staff-p-149#2024-support-staff-duty-guide#0
2024-staff-p-149#2024-support-staff-duty-guide#1
2024-staff-p-149#2024-support-staff-duty-guide#2
2024-staff-p-149#2024-support-staff-duty-guide#3
EOF
# hr·jbu 케이스에서 페이지 hint 있는 6건 추가 (image-mapping-disputed.md의 review 절 외 skip 절에서 페이지 hint 있는 케이스 검색)
grep -B 1 "no-raster-in-range" docs/image-mapping-disputed.md | grep "^-" | head -6 | sed 's/^- `//' | sed "s/`.*//" >> /tmp/image-match-poc/sample-keys.txt
cat /tmp/image-match-poc/sample-keys.txt
```

- [ ] **Step 2: 시뮬레이션 스크립트 작성**

기존 `/tmp/image-match-poc/auto-mapping.mjs` 패턴을 재사용. raster pool 디렉터리만 baseline → Task A7 채택 후보 도구로 교체.

```javascript
cat > /tmp/image-match-poc/sample-simulate.mjs <<'EOF'
#!/usr/bin/env node
/**
 * 채택 후보 도구의 raster pool로 샘플 10건에 대해 3종 cross-validation 실행.
 * Gemini·Gemma·Claude 만장일치(3/3) 통과 개수를 측정.
 * Codex는 본 자동화에서 합류 — PoC는 도구 비교 상대 지표가 목적.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 채택 후보 도구의 raster pool 디렉터리 (Task A7 결과 보고 채움)
const CANDIDATE_POOL = '/tmp/image-match-poc/rasters/pymupdf-pages'; // 예시

// auto-mapping.mjs의 핵심 함수를 import 또는 복사
// (실제 코드는 auto-mapping.mjs 참조. 3종 병렬 호출 + verdict 합의 패턴)
EOF
```

(전체 코드는 `/tmp/image-match-poc/auto-mapping.mjs`를 그대로 참조 — 단순 raster pool 경로 교체.)

- [ ] **Step 3: 시뮬레이션 실행**

```bash
node /tmp/image-match-poc/sample-simulate.mjs > /tmp/image-match-poc/sample-results.json
cat /tmp/image-match-poc/sample-results.json | jq '.summary'
```

Expected:
```json
{
  "total": 10,
  "consensus_3_3": <X>,
  "consensus_2_3": <Y>,
  "consensus_under": <Z>
}
```

`consensus_3_3` 개수가 채택 도구 선정의 핵심 지표.

---

## Task A9: PoC 보고서 작성

**Files:**
- Create: `/tmp/image-match-poc/raster-tools-comparison.md` (git ignored)
- Modify: `docs/superpowers/specs/2026-05-18-phase-1-5b-86-image-automation-design.md`

- [ ] **Step 1: 보고서 작성**

`/tmp/image-match-poc/raster-tools-comparison.md`에 다음 구조로 정리:

```markdown
# raster 추출 도구 비교 보고서 (Phase 1.5b PR A)

대상 PDF: 2023 장애인교원 인사관리 안내서.pdf
실행 일자: 2026-05-19

## 도구별 raster 개수

| 도구 | 개수 | baseline 대비 |
|------|------|--------------|
| baseline (PyMuPDF get_images) | 22 | 1.0× |
| pdftocairo (pdfimages) | <X> | <X/22>× |
| PyMuPDF 페이지 렌더 | <Y> | <Y/22>× |
| docparse | <Z 또는 skip> | — |
| opendataloader-pdf | <W 또는 skip> | — |

## 도구 간 중복 raster

<Task A7 결과 요약>

## alt 매칭 시뮬레이션 결과 (샘플 10건)

| 도구 | 3/3 합의 통과 | 2/3 부분 합의 | 0~1/3 |
|------|--------------|--------------|-------|
| pdftocairo | <a> | <b> | <c> |
| PyMuPDF 페이지 렌더 | <d> | <e> | <f> |
| docparse | — | — | — |
| opendataloader-pdf | — | — | — |

**주의**: PoC는 도구 채택용 상대 비교 지표. 본 자동화에서 Codex 합류 시 합의 게이트가 더 강해져 자동 적용률이 PoC simulation보다 낮아질 수 있다.

## PDF outline 추출 가능성

<Task A6 결과>

- 4개 PDF 모두 outline 추출 성공: yes/no
- chapter slug ↔ outline title 매칭 가능: yes/no
- 매칭 가능 시 60건 chapter slug에 page range 부여 가능

## 채택 결정

- raster 보강 채택 도구: <도구명>
- 사유: <개수 + 매칭 정확도 + 도구 안정성>
- chapter slug page-range 부여 방식: `frontmatter.pageRange` / `_image-mappings.json` 메타 / 별도 매핑 테이블 중 <선택>
- 사유: <이유>
```

- [ ] **Step 2: spec에 PoC 결과 절 추가**

`docs/superpowers/specs/2026-05-18-phase-1-5b-86-image-automation-design.md` 의 §3.1 끝에 다음 절 추가:

```markdown
### 3.1.1 PoC 결과 (2026-05-19 PR A 머지)

- **채택 도구**: <도구명>
  - baseline 22개 → 채택 도구 <N>개로 raster pool 확장
  - 샘플 10건 중 <X>건 3/3 합의 통과
- **chapter slug page-range 부여 방식**: <선택>
- **chapter outline 추출 가능 여부**: yes/no
- **PoC 보고서**: `/tmp/image-match-poc/raster-tools-comparison.md` (git ignored)
```

---

## Task A10: 커밋 + PR A 생성

- [ ] **Step 1: 변경 확인**

```bash
git status --short
git diff --stat
```

Expected:
- `docs/superpowers/plans/2026-05-18-phase-1-5b-pr-a-raster-pool-poc.md` (Create)
- `docs/superpowers/specs/2026-05-18-phase-1-5b-86-image-automation-design.md` (Modify, PoC 결과 추가)

- [ ] **Step 2: 커밋**

```bash
git add docs/superpowers/plans/2026-05-18-phase-1-5b-pr-a-raster-pool-poc.md docs/superpowers/specs/2026-05-18-phase-1-5b-86-image-automation-design.md
git commit -m "$(cat <<'EOF'
docs(phase-1-5b): PR A — raster pool 보강 PoC 결과 + 채택 도구 결정

4종 추출 도구 비교 PoC 실행. 채택: <도구명> (baseline 22 → <N>개).
샘플 10건 중 <X>건 3/3 합의 통과. chapter outline 추출 <가능/불가>로
60건 chapter slug page-range 부여 방식 <선택>.

PoC 보고서는 /tmp/image-match-poc/raster-tools-comparison.md (git ignored).
PR B 진입 조건 충족.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: PR 생성**

```bash
git push -u origin phase-1-5b-raster-pool-poc
gh pr create --title "Phase 1.5b PR A — raster pool 보강 PoC + 채택 도구 결정" --body "$(cat <<'EOF'
## Summary

- 4종 raster 추출 도구를 2023-hr-guide.pdf에 적용해 raster 개수·중복률·alt 매칭 시뮬레이션·outline 추출 가능성 측정
- 채택 도구: <도구명> (baseline 22 → <N>개)
- chapter slug page-range 부여 방식: <선택>
- PoC 보고서는 /tmp/image-match-poc/raster-tools-comparison.md (git ignored)

## Test plan

- [ ] PoC 보고서 결과 spec §3.1.1에 정확히 반영됐는지 확인
- [ ] 채택 도구 선정 사유가 합리적인지 검토
- [ ] PR B 진입 조건(채택 도구 + page-range 방식)이 명확한지 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: codex-rescue dispatch**

PR A diff는 spec/plan 갱신뿐이라 가벼움. 그래도 dispatch:

```
Agent({
  subagent_type: "codex:codex-rescue",
  description: "Phase 1.5b PR A spec·plan 갱신 리뷰",
  prompt: "Phase 1.5b PR A의 변경(plan 파일 신규 + spec §3.1.1 PoC 결과 추가)을 검토. 리뷰 포커스: (1) 채택 도구 선정 사유가 측정 지표와 정합한가? (2) chapter slug page-range 부여 방식이 향후 PR B 작업과 충돌 없이 진행 가능한가? (3) PoC 결과 절이 향후 PR B plan 작성 시 입력 매개변수로 충분한가? 200단어 이내로 보고."
})
```

- [ ] **Step 5: 머지**

codex-rescue 통과 후:

```bash
gh pr merge --squash --delete-branch
git checkout master && git pull
```

---

## Self-Review

### Spec coverage check

- §3.1 raster 보강 PoC → Task A1~A9 (5개 측정 지표 모두 cover)
- §3.1 산출물 — PR A → Task A10
- §6 PR 전략 — PR A → Task A10

미커버 항목 없음.

### Placeholder scan

- Task A4 docparse·Task A5 opendataloader는 "지원 시 실행 / 미지원 시 skip" 분기 존재 — placeholder가 아니라 실제 실행 후 결정 사항. 명시적 skip 처리 step 포함.
- Task A2의 PDF 경로에 한글 파일명("2023 장애인교원 인사관리 안내서.pdf") — `data/source-pdf/`의 실제 파일명 그대로. shell escape 필요한 케이스라 큰따옴표로 감쌌음.

### Type consistency

- raster 디렉터리 구조: `/tmp/image-match-poc/rasters/<도구명>/` — Task A1~A5 일관.
- 채택 후보 도구 변수명: 모든 task에서 "채택 도구"로 일관.

### 명세 누락 보강

Task A3 PyMuPDF 페이지 렌더 → 페이지 전체 raster가 너무 크면 합의 게이트가 alt와 매칭 어려울 수 있음. 이 위험은 Task A8 시뮬레이션에서 정량 측정 후 채택 결정에서 고려. spec §9 위험 표의 "raster 도구 union 시 노이즈" 항목과 동일 위험 — 이미 다뤄짐.

---

## 실행 옵션

Plan 완성. `docs/superpowers/plans/2026-05-18-phase-1-5b-pr-a-raster-pool-poc.md`에 저장됨.

**1. Subagent-Driven (권장)** — task별 fresh subagent dispatch, task 간 리뷰, 빠른 iteration. PR A는 PoC라 실험·측정 task들이 독립적이라 적합.

**2. Inline Execution** — 현 세션에서 executing-plans skill로 batch 실행, 체크포인트로 리뷰.
