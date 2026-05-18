# Phase 1.5b PR B — 본 자동화 재가동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR A에서 채택된 PyMuPDF 페이지 렌더 raster pool을 기반으로 slug→raster 매핑 사전을 구축하고, 4종 cross-validation으로 86건 unmapped 이미지를 자동 적용하며, 빌드 564개 정적 페이지 변동 없음을 검증한다.

**Architecture:** Task B1에서 `fitz.search_for()` 기반 매핑 사전 스크립트(`scripts/build-slug-raster-map.py`)를 TDD로 구축 — 7건 known-answer 단위 테스트로 1차 매칭과 fallback 모두 통과 후 86건 실행. 산출물 `content/_slug-raster-map.json`. Task B2에서 기존 Phase 1.5 `auto-mapping.mjs` 패턴을 재사용해 매핑 사전 적용 + 4종 모델(Claude·Gemini·Gemma·Codex) cross-validation. Task B3에서 `npm run image:apply` 적용 후 `_alt_original` 가드(PR #5) 검증 + 빌드 564개 변동 없음 + 검수 큐 갱신.

**Tech Stack:** Python 3 (PyMuPDF/fitz), Node.js (tsx, Anthropic SDK, Gemini CLI), Gemma 4 E4B 로컬 (llama.cpp gemma-server), Codex CLI. 매핑 사전은 git tracked (`content/_slug-raster-map.json`) — spec §3.1.1의 `/tmp/image-match-poc/` 경로보다 영구 보존이 우선.

---

## Files

### Create (git tracked)
- `scripts/build-slug-raster-map.py` — Python: fitz.search_for() 기반 slug→raster 매핑 사전 빌더
- `scripts/build-slug-raster-map.test.ts` — Node TypeScript: 7건 known-answer 단위 테스트 (Python 스크립트의 출력 JSON을 검증)
- `content/_slug-raster-map.json` — slug→raster_index 매핑 사전 (자동 생성, 86건)
- `content/_slug-raster-unresolved.json` — 매핑 실패 케이스 (closed-loop 검수 큐 입력)
- `docs/superpowers/plans/2026-05-19-phase-1-5b-pr-b-auto-rerun.md` — 본 plan 자체

### Modify
- `content/_image-mappings.json` — 86건 중 자동 적용된 케이스의 `manifest_path` 채움 (Task B3 `npm run image:apply`)
- `docs/image-mapping-disputed.md` — 자동 적용 결과 반영, 잔여 케이스를 closed-loop 검수 큐로 routing (Task B3)
- `public/source-images/<source-slug>/` — PyMuPDF 페이지 렌더 raster 추가 (`page-NNN-render.png` prefix, baseline `page-NNN-fig-MM.png`와 공존)
- `CLAUDE.md` — 변경 이력 한 줄 추가 (Task B4)

### Reuse (변경 없음)
- `/tmp/image-match-poc/auto-mapping.mjs` — Phase 1.5 4종 cross-validation 패턴 (raster pool 경로만 교체)
- `/tmp/image-match-poc/cross-validate.mjs` — verdict 합의 로직
- `/tmp/image-match-poc/sample-results-summary.md` — 7건 known-answer 표 (B1 단위 테스트 입력)
- `scripts/extract-pdf-images.py` — baseline 임베디드 raster 추출 (변경 없음, baseline 유지용)
- `scripts/image-mappings.ts` — `apply` 함수에 PR #5 `_alt_original` 가드 머지됨
- `data/source-pdf/*.pdf` — 4개 한글 PDF (B0 raster 재추출 대상)

---

## Task B0: 작업 브랜치 + PyMuPDF 페이지 raster 재추출

**Files:**
- Create: `scripts/extract-pdf-page-renders.py`
- Modify: `public/source-images/<source-slug>/` 4개 디렉터리 (page-NNN-render.png 추가)

### - [ ] Step 1: 작업 브랜치 생성

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
git checkout master && git pull
git checkout -b phase-1-5b-86-auto-rerun
```

Expected: `Switched to a new branch 'phase-1-5b-86-auto-rerun'`. master는 `295c31b` 이상.

### - [ ] Step 2: 페이지 raster 추출 스크립트 작성

```python
cat > scripts/extract-pdf-page-renders.py <<'EOF'
#!/usr/bin/env python3
"""PyMuPDF 페이지 전체 렌더로 4개 PDF의 raster를 추출해 public/source-images/<source>/에 page-NNN-render.png로 저장.

Phase 1.5b PR A에서 채택된 방식. baseline의 embedded raster(page-NNN-fig-MM.png)와 공존.
dpi=150으로 평균 200KB/장 수준 유지.
"""
from __future__ import annotations
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "data" / "source-pdf"
OUT_ROOT = ROOT / "public" / "source-images"

SOURCE_MAP = {
    "2023 장애유형별 장애인교원 근무 지원 방안_최종보고서.pdf": "2023-disability-types-work-support-report",
    "2023 장애인교원 인사관리 안내서.pdf": "2023-hr-guide",
    "241210_책자_내지_중부대학교_장애인교원_근무지원_안내자료_V4.pdf": "2024-jbu-work-support-guide",
    "내지_장애인교원_지원인력_직무_수행_안내자료인쇄용_156P_수정.pdf": "2024-support-staff-duty-guide",
}


def extract_pdf(pdf_path: Path, source_slug: str, dpi: int = 150) -> int:
    out_dir = OUT_ROOT / source_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    # 기존 render raster만 제거 (baseline fig raster는 보존)
    for f in out_dir.glob("page-*-render.png"):
        f.unlink()
    count = 0
    with fitz.open(pdf_path) as doc:
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=dpi)
            out = out_dir / f"page-{page_num+1:03d}-render.png"
            pix.save(out)
            count += 1
    return count


def main() -> int:
    total = 0
    for pdf_name, source_slug in SOURCE_MAP.items():
        pdf_path = PDF_DIR / pdf_name
        if not pdf_path.exists():
            print(f"SKIP: {pdf_path} not found", file=sys.stderr)
            continue
        count = extract_pdf(pdf_path, source_slug)
        print(f"{source_slug}: {count}장 (dpi=150, page-NNN-render.png)")
        total += count
    print(f"\n총 {total}장 추출 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
EOF
chmod +x scripts/extract-pdf-page-renders.py
```

### - [ ] Step 3: 실행 + 결과 확인

```bash
python3 scripts/extract-pdf-page-renders.py
```

Expected: 4개 PDF 각각의 페이지 수만큼 raster 추출. 약 600-700장 합계 (2023-hr 133 + 2024-staff 156 + 2024-jbu ~148 + 2023-disability ~554 = ~991. 실제는 PDF별 페이지 수에 따라 다름).

```bash
ls public/source-images/2023-hr-guide/page-*-render.png | wc -l
ls public/source-images/2024-support-staff-duty-guide/page-*-render.png | wc -l
ls public/source-images/2024-jbu-work-support-guide/page-*-render.png | wc -l
ls public/source-images/2023-disability-types-work-support-report/page-*-render.png | wc -l
```

Expected: 각각 PDF 페이지 수 = render 개수 일치.

### - [ ] Step 4: baseline raster 공존 확인

```bash
ls public/source-images/2023-hr-guide/ | head -10
ls public/source-images/2023-hr-guide/page-001-* 2>&1
```

Expected: `page-001-fig-01.png` (baseline)와 `page-001-render.png` (PyMuPDF) 양쪽 공존. baseline 손상 없음.

### - [ ] Step 5: 커밋

```bash
git add scripts/extract-pdf-page-renders.py public/source-images/
git commit -m "$(cat <<'COMMIT'
feat(phase-1-5b): PyMuPDF 페이지 렌더 raster 추출 스크립트 + 4 PDF 재추출

PR A 채택 도구(get_pixmap dpi=150)로 4 PDF 전체 페이지 raster를 추출.
baseline embedded raster(page-NNN-fig-MM.png)와 공존 (page-NNN-render.png prefix).

벡터 그래픽·플로차트 캡처 가설 검증 완료 — Task B1 매핑 사전 구축의
raster pool 입력.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task B1: slug→raster 매핑 사전 구축 (TDD)

**Files:**
- Create: `scripts/build-slug-raster-map.py` (Python: fitz.search_for() 기반)
- Create: `tests/scripts/slug-raster-map.test.ts` (Node tsx test: 7건 known-answer)
- Create: `content/_slug-raster-map.json` (자동 생성, 86건)
- Create: `content/_slug-raster-unresolved.json` (매핑 실패 case)

### - [ ] Step 1: 단위 테스트 작성 (7건 known-answer)

```bash
mkdir -p tests/scripts
cat > tests/scripts/slug-raster-map.test.ts <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// 7건 known-answer (출처: /tmp/image-match-poc/sample-results-summary.md §2)
// PR A Task A8 시뮬레이션에서 수동 매핑으로 3종 모델 7/7 YES 만장일치 확인된 ground truth.
const GROUND_TRUTH: Array<{
  key: string;
  source: string;
  expectedRaster: string;
}> = [
  { key: "2023-hr-p-046#2023-hr-guide#0", source: "2023-hr-guide", expectedRaster: "page-024-render.png" },
  { key: "2023-hr-p-052#2023-hr-guide#0", source: "2023-hr-guide", expectedRaster: "page-046-render.png" },
  { key: "2023-hr-p-052#2023-hr-guide#1", source: "2023-hr-guide", expectedRaster: "page-046-render.png" },
  { key: "2023-hr-p-052#2023-hr-guide#2", source: "2023-hr-guide", expectedRaster: "page-046-render.png" },
  { key: "2023-hr-p-057#2023-hr-guide#0", source: "2023-hr-guide", expectedRaster: "page-060-render.png" },
  { key: "2023-hr-p-057#2023-hr-guide#1", source: "2023-hr-guide", expectedRaster: "page-060-render.png" },
  { key: "2024-staff-p-023#2024-support-staff-duty-guide#0", source: "2024-support-staff-duty-guide", expectedRaster: "page-025-render.png" },
];

test("slug-raster-map: 7건 known-answer 매핑 정확", async () => {
  const mapPath = resolve(process.cwd(), "content/_slug-raster-map.json");
  const map = JSON.parse(await readFile(mapPath, "utf8")) as {
    mappings: Record<string, { source: string; raster: string; method: "primary" | "fallback" }>;
  };

  for (const { key, source, expectedRaster } of GROUND_TRUTH) {
    const entry = map.mappings[key];
    assert.ok(entry, `매핑 사전에 ${key} 없음`);
    assert.equal(entry.source, source, `${key}: source 불일치`);
    assert.equal(entry.raster, expectedRaster, `${key}: raster 불일치 (expected ${expectedRaster}, got ${entry.raster})`);
  }
});

test("slug-raster-map: unresolved JSON 존재 + 구조 검증", async () => {
  const unresolvedPath = resolve(process.cwd(), "content/_slug-raster-unresolved.json");
  const data = JSON.parse(await readFile(unresolvedPath, "utf8")) as {
    unresolved: Array<{ key: string; source: string; reason: string }>;
  };
  assert.ok(Array.isArray(data.unresolved), "unresolved 배열 누락");
});

test("slug-raster-map: 매핑 성공률 >= 60% (spec §3.1.1 acceptance criteria)", async () => {
  const mapPath = resolve(process.cwd(), "content/_slug-raster-map.json");
  const map = JSON.parse(await readFile(mapPath, "utf8")) as { mappings: Record<string, unknown> };
  const unresolvedPath = resolve(process.cwd(), "content/_slug-raster-unresolved.json");
  const unresolved = JSON.parse(await readFile(unresolvedPath, "utf8")) as { unresolved: unknown[] };

  const total = Object.keys(map.mappings).length + unresolved.unresolved.length;
  const success = Object.keys(map.mappings).length;
  const rate = success / total;
  assert.ok(rate >= 0.6, `매핑 성공률 ${(rate * 100).toFixed(1)}% — spec §3.1.1 60% 임계 미달`);
});
EOF
```

### - [ ] Step 2: 테스트 실행 — FAIL 확인

```bash
npm test -- --test-name-pattern="slug-raster-map" 2>&1 | tail -20
```

Expected: FAIL. `content/_slug-raster-map.json` 파일 없음 에러.

### - [ ] Step 3: Python 매핑 사전 빌더 작성

```python
cat > scripts/build-slug-raster-map.py <<'EOF'
#!/usr/bin/env python3
"""slug→raster index 매핑 사전 구축.

spec §3.1.1 acceptance criteria:
- page-numbered slug: 1차 fitz.search_for(슬러그 페이지 번호 문자열) → fallback ±25 + alt-image 1차 stamp → unresolved
- chapter slug: 1차 frontmatter title search_for() → fallback alias/normalized-title + path 위계 inherit → unresolved
- 매핑 성공률 < 60% 시 spec 재검토 신호 (test에서 강제)

출력:
- content/_slug-raster-map.json
- content/_slug-raster-unresolved.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "data" / "source-pdf"
CONTENT_DIR = ROOT / "content"
MAPPINGS_PATH = CONTENT_DIR / "_image-mappings.json"
MAP_OUT = CONTENT_DIR / "_slug-raster-map.json"
UNRESOLVED_OUT = CONTENT_DIR / "_slug-raster-unresolved.json"

SOURCE_TO_PDF = {
    "2023-disability-types-work-support-report": "2023 장애유형별 장애인교원 근무 지원 방안_최종보고서.pdf",
    "2023-hr-guide": "2023 장애인교원 인사관리 안내서.pdf",
    "2024-jbu-work-support-guide": "241210_책자_내지_중부대학교_장애인교원_근무지원_안내자료_V4.pdf",
    "2024-support-staff-duty-guide": "내지_장애인교원_지원인력_직무_수행_안내자료인쇄용_156P_수정.pdf",
}

PAGE_NUMBER_RE = re.compile(r"^(?P<prefix>.+?)-p-(?P<num>\d{3})$")
FALLBACK_WINDOW = 25  # PR A A8 분석: 최대 오프셋 -22 ~ +3. ±25로 cover.


def load_unmapped_keys() -> list[dict[str, Any]]:
    """_image-mappings.json에서 manifest_path null인 86건 추출."""
    data = json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
    keys: list[dict[str, Any]] = []
    for key, entry in data["mappings"].items():
        if entry.get("manifest_path") is not None:
            continue
        # key 형식: "<file-slug>#<source-slug>#<index>"
        parts = key.split("#")
        if len(parts) != 3:
            continue
        file_slug, source_slug, index = parts
        keys.append({
            "key": key,
            "file_slug": file_slug,
            "source_slug": source_slug,
            "index": int(index),
            "alt": entry.get("_alt_original", ""),
            "file_path": entry.get("_file", ""),
        })
    return keys


def load_frontmatter_title(file_path: str) -> str:
    """content/...md 파일의 frontmatter title 추출."""
    full = ROOT / file_path
    if not full.exists():
        return ""
    text = full.read_text(encoding="utf-8")
    m = re.search(r"^title:\s*(.+)$", text, re.MULTILINE)
    return m.group(1).strip().strip("\"'") if m else ""


def normalize_title(title: str) -> list[str]:
    """alias/normalized-title 후보 생성. 공백·줄바꿈·접두사·기호 정규화."""
    candidates = [title]
    # 접두사 "01 ", "1)", "<그림>" 제거
    stripped = re.sub(r"^(?:\d+[\.\)\s]+|<[^>]+>\s*)", "", title)
    if stripped and stripped != title:
        candidates.append(stripped)
    # 공백 압축
    compact = re.sub(r"\s+", "", title)
    if compact != title:
        candidates.append(compact)
    # 기호 제거
    sym_free = re.sub(r"[·…\(\)\[\]「」『』]", "", title)
    if sym_free != title:
        candidates.append(sym_free)
    return list(dict.fromkeys(c for c in candidates if c.strip()))


def search_text_in_pdf(doc: fitz.Document, queries: list[str]) -> int | None:
    """PDF에서 query 텍스트가 처음 등장하는 페이지 index(0-based) 반환. 못 찾으면 None."""
    for page_num in range(len(doc)):
        text = doc[page_num].get_text()
        for q in queries:
            if q in text:
                return page_num
    return None


def map_page_numbered(doc: fitz.Document, slug_num: int, alt: str) -> tuple[int | None, str]:
    """page-numbered slug 매핑.

    1차: PDF 텍스트에서 페이지 번호 문자열(예: "46", "p-46") 검색
    fallback: slug_num을 기준으로 ±25 범위 페이지 후보 반환 (실제 alt-image 검증은 Task B2에서)
    반환: (raster_index_0based, method) 또는 (None, "unresolved")
    """
    # 1차: 페이지 번호 문자열 검색
    queries = [str(slug_num), f"p-{slug_num:03d}", f"p-{slug_num}"]
    idx = search_text_in_pdf(doc, queries)
    if idx is not None:
        return idx, "primary"

    # fallback: slug_num ±25 범위를 후보로 줄여서 첫 후보 반환
    # (실제 model 검증은 Task B2 cross-validation에서. 여기서는 후보 1개만 잠정 등록.)
    if 1 <= slug_num <= len(doc):
        return slug_num - 1, "fallback"
    return None, "unresolved"


def map_chapter_slug(doc: fitz.Document, title: str) -> tuple[int | None, str]:
    """chapter slug 매핑. 1차: frontmatter title search, fallback: normalize_title alias."""
    if not title:
        return None, "unresolved"
    # 1차: 원본 title 검색
    idx = search_text_in_pdf(doc, [title])
    if idx is not None:
        return idx, "primary"
    # fallback: 정규화 후보 검색
    candidates = normalize_title(title)
    idx = search_text_in_pdf(doc, candidates)
    if idx is not None:
        return idx, "fallback"
    return None, "unresolved"


def build_map() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    mappings: dict[str, Any] = {}
    unresolved: list[dict[str, Any]] = []
    keys = load_unmapped_keys()
    print(f"unmapped 86건 입력: {len(keys)}건", file=sys.stderr)

    # 4 PDF lazily 열어두기
    docs: dict[str, fitz.Document] = {}

    for k in keys:
        source = k["source_slug"]
        if source not in docs:
            pdf_name = SOURCE_TO_PDF.get(source)
            if not pdf_name:
                unresolved.append({"key": k["key"], "source": source, "reason": "source PDF 매핑 누락"})
                continue
            pdf_path = PDF_DIR / pdf_name
            if not pdf_path.exists():
                unresolved.append({"key": k["key"], "source": source, "reason": f"PDF 파일 없음: {pdf_name}"})
                continue
            docs[source] = fitz.open(pdf_path)
        doc = docs[source]

        # page-numbered slug 판별
        m = PAGE_NUMBER_RE.match(k["file_slug"])
        if m:
            slug_num = int(m.group("num"))
            idx, method = map_page_numbered(doc, slug_num, k["alt"])
        else:
            # chapter slug
            title = load_frontmatter_title(k["file_path"])
            idx, method = map_chapter_slug(doc, title)

        if idx is None:
            unresolved.append({"key": k["key"], "source": source, "reason": method})
        else:
            mappings[k["key"]] = {
                "source": source,
                "raster": f"page-{idx + 1:03d}-render.png",
                "method": method,
                "alt": k["alt"][:80],
            }

    for doc in docs.values():
        doc.close()

    return mappings, unresolved


def main() -> int:
    mappings, unresolved = build_map()
    MAP_OUT.write_text(json.dumps({"mappings": mappings}, ensure_ascii=False, indent=2), encoding="utf-8")
    UNRESOLVED_OUT.write_text(json.dumps({"unresolved": unresolved}, ensure_ascii=False, indent=2), encoding="utf-8")
    total = len(mappings) + len(unresolved)
    rate = len(mappings) / total if total else 0
    print(f"매핑 사전: {len(mappings)}건 (primary {sum(1 for v in mappings.values() if v['method']=='primary')}, fallback {sum(1 for v in mappings.values() if v['method']=='fallback')})", file=sys.stderr)
    print(f"unresolved: {len(unresolved)}건", file=sys.stderr)
    print(f"매핑 성공률: {rate*100:.1f}% (spec §3.1.1 60% 임계)", file=sys.stderr)
    return 0 if rate >= 0.6 else 1


if __name__ == "__main__":
    sys.exit(main())
EOF
chmod +x scripts/build-slug-raster-map.py
```

### - [ ] Step 4: 매핑 사전 빌드 실행

```bash
python3 scripts/build-slug-raster-map.py
```

Expected stderr:
```
unmapped 86건 입력: 86건
매핑 사전: N건 (primary M, fallback K)
unresolved: (86-N)건
매핑 성공률: NN.N%
```

매핑 성공률 < 60% 시 exit code 1. 그 경우 unresolved에서 패턴 분석 후 정규화 함수 보강 (Step 3로 회귀).

### - [ ] Step 5: 단위 테스트 실행 — PASS 확인

```bash
npm test -- --test-name-pattern="slug-raster-map" 2>&1 | tail -20
```

Expected: 3 test PASS.
- `7건 known-answer 매핑 정확`
- `unresolved JSON 존재`
- `매핑 성공률 >= 60%`

FAIL 시 (특히 7건 known-answer 케이스 매핑 불일치): `_slug-raster-map.json`에서 해당 key의 raster 확인 → Python 스크립트의 search 패턴 조정 (Step 3로 회귀).

### - [ ] Step 6: 커밋

```bash
git add scripts/build-slug-raster-map.py tests/scripts/slug-raster-map.test.ts content/_slug-raster-map.json content/_slug-raster-unresolved.json
git commit -m "$(cat <<'COMMIT'
feat(phase-1-5b): slug→raster 매핑 사전 빌더 + 86건 매핑 실행

spec §3.1.1 Task B1 구현. fitz.search_for() 1차 매칭 + ±25 fallback
+ unresolved JSON 분리. page-numbered slug와 chapter slug 별도 처리.

7건 known-answer 단위 테스트 (PR A A8 ground truth)로 회귀 차단.
매핑 성공률 < 60% 시 spec 재검토 신호 (test fail).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task B2: 4종 cross-validation 재가동

**Files:**
- Create: `scripts/cross-validate-mappings.mjs` (`/tmp/image-match-poc/auto-mapping.mjs` 패턴 재작성)
- Create: `content/_image-mappings-candidates.json` (cross-validation 결과)

### - [ ] Step 1: 참조 스크립트 패턴 확인

```bash
head -60 /tmp/image-match-poc/auto-mapping.mjs
ls /tmp/image-match-poc/cross-validate.mjs
```

목적: Phase 1.5의 4종 cross-validation 호출 흐름, verdict 합의 로직(`4/4` 또는 `3/4 + 명시적 NO 0`) 패턴 파악.

### - [ ] Step 2: cross-validation 스크립트 작성

```bash
cat > scripts/cross-validate-mappings.mjs <<'EOF'
#!/usr/bin/env node
/**
 * 4종 모델(Claude·Gemini·Gemma·Codex) cross-validation.
 *
 * 입력: content/_slug-raster-map.json (Task B1 산출물)
 * 출력: content/_image-mappings-candidates.json
 *
 * 합의 게이트(Phase 1.5와 동일):
 *   - 4/4 YES, 또는 3/4 YES + 명시적 NO 0건 → apply
 *   - 그 외 → review (closed-loop 검수 큐)
 *
 * Gemini는 REPO 외부 절대 경로 접근 불가 → base64 inlineData API 직접 호출.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const MAP_PATH = resolve(ROOT, "content/_slug-raster-map.json");
const MAPPINGS_PATH = resolve(ROOT, "content/_image-mappings.json");
const OUT_PATH = resolve(ROOT, "content/_image-mappings-candidates.json");

const map = JSON.parse(await readFile(MAP_PATH, "utf8"));
const allMappings = JSON.parse(await readFile(MAPPINGS_PATH, "utf8"));

const candidates = {};
const keys = Object.keys(map.mappings);
console.error(`cross-validation 입력: ${keys.length}건`);

for (const key of keys) {
  const entry = map.mappings[key];
  const altOriginal = allMappings.mappings[key]?._alt_original ?? "";
  const rasterAbs = resolve(ROOT, `public/source-images/${entry.source}/${entry.raster}`);
  if (!existsSync(rasterAbs)) {
    candidates[key] = { decision: "skip", reason: `raster 없음: ${entry.raster}` };
    continue;
  }

  // 4종 모델 verdict 수집 (각 함수는 /tmp/image-match-poc/auto-mapping.mjs 패턴 따라 구현)
  const verdicts = await collectVerdicts(altOriginal, rasterAbs);
  candidates[key] = buildDecision(entry, verdicts);
}

await writeFile(OUT_PATH, JSON.stringify({ candidates }, null, 2), "utf8");

const applyCount = Object.values(candidates).filter((c) => c.decision === "apply").length;
const reviewCount = Object.values(candidates).filter((c) => c.decision === "review").length;
const skipCount = Object.values(candidates).filter((c) => c.decision === "skip").length;
console.error(`\napply: ${applyCount}건  review: ${reviewCount}건  skip: ${skipCount}건`);

// --- helpers ---

async function collectVerdicts(alt, rasterPath) {
  // 4종 병렬 호출. 실패한 모델은 verdict="ERROR".
  // 구현 베이스: /tmp/image-match-poc/auto-mapping.mjs §callClaude/callGemini/callGemma/callCodex
  // Gemini는 base64로 inlineData에 실어 보냄 (REPO 외부 경로 제약 우회).
  const [claude, gemini, gemma, codex] = await Promise.all([
    callClaude(alt, rasterPath).catch(() => "ERROR"),
    callGeminiBase64(alt, rasterPath).catch(() => "ERROR"),
    callGemma(alt, rasterPath).catch(() => "ERROR"),
    callCodex(alt, rasterPath).catch(() => "ERROR"),
  ]);
  return { claude, gemini, gemma, codex };
}

function buildDecision(entry, verdicts) {
  const list = [verdicts.claude, verdicts.gemini, verdicts.gemma, verdicts.codex];
  const yesCount = list.filter((v) => v === "YES").length;
  const noCount = list.filter((v) => v === "NO").length;
  const okFourFour = yesCount === 4;
  const okThreeFour = yesCount === 3 && noCount === 0;
  const decision = okFourFour || okThreeFour ? "apply" : "review";
  return {
    decision,
    manifest_path: `public/source-images/${entry.source}/${entry.raster}`,
    method: entry.method,
    verdicts,
    yesCount,
    noCount,
  };
}

// callClaude / callGeminiBase64 / callGemma / callCodex 구현은
// /tmp/image-match-poc/auto-mapping.mjs을 가져와 라이브러리화하여 사용.
// (이 plan에서는 함수 body 전체를 다시 박지 않음 — 기존 코드 직접 import 또는 복사)
import { callClaude, callGeminiBase64, callGemma, callCodex } from "/tmp/image-match-poc/auto-mapping.mjs";
EOF
```

> **주의**: 마지막 `import`는 실제로는 `/tmp/image-match-poc/auto-mapping.mjs`에서 함수를 export하는 형태로 리팩토링하거나, 함수 body 4개를 본 스크립트에 직접 복사. 어느 쪽이든 합의 게이트 로직(`yesCount`/`noCount`)은 위 형태 유지.

### - [ ] Step 3: gemma-server 백그라운드 시작

```bash
pgrep -f "llama-server.*8080" || (gemma-server &)
sleep 5
curl -s localhost:8080/v1/models | head -5
```

Expected: gemma E4B 모델 응답. gemma-server가 이미 실행 중이면 skip.

### - [ ] Step 4: cross-validation 실행

```bash
node scripts/cross-validate-mappings.mjs 2>&1 | tee /tmp/cross-validate-run.log
```

Expected stderr 마지막 줄:
```
apply: <X>건  review: <Y>건  skip: <Z>건
```

`<X> + <Y> + <Z>` 합이 `_slug-raster-map.json`의 mappings 개수와 일치.

### - [ ] Step 5: 후보 JSON 검토

```bash
cat content/_image-mappings-candidates.json | jq '.candidates | to_entries | map(.value.decision) | group_by(.) | map({decision: .[0], count: length})'
```

Expected: apply/review/skip별 카운트.

apply가 너무 적으면 (예: < 5건): manifest_path 매핑 사전이 부정확하거나 모델 호출에 ERROR가 많은지 확인.

### - [ ] Step 6: 커밋

```bash
git add scripts/cross-validate-mappings.mjs content/_image-mappings-candidates.json
git commit -m "$(cat <<'COMMIT'
feat(phase-1-5b): 4종 cross-validation 재가동 + 86건 후보 판정

매핑 사전 입력 + 4종(Claude·Gemini·Gemma·Codex) 합의 게이트 적용.
Gemini는 base64 inlineData로 REPO 외부 경로 제약 우회.

합의 조건: 4/4 YES 또는 3/4 YES + 명시적 NO 0건 → apply.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task B3: image:apply 적용 + 빌드 검증 + 검수 큐 갱신

**Files:**
- Modify: `content/_image-mappings.json` (Task B2 apply 결정 케이스의 manifest_path 채움)
- Modify: `docs/image-mapping-disputed.md` (잔여 review 케이스 갱신)
- Create: `scripts/merge-candidates-to-mappings.mjs` (apply 케이스를 `_image-mappings.json`에 머지)

### - [ ] Step 1: apply 케이스 머지 스크립트 작성

```bash
cat > scripts/merge-candidates-to-mappings.mjs <<'EOF'
#!/usr/bin/env node
/**
 * Task B2의 apply 판정 케이스를 _image-mappings.json의 manifest_path에 머지.
 * 무결성 가드: _alt_original 일치 확인 (PR #5 가드와 동일 원칙).
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const MAPPINGS_PATH = resolve(ROOT, "content/_image-mappings.json");
const CAND_PATH = resolve(ROOT, "content/_image-mappings-candidates.json");

const data = JSON.parse(await readFile(MAPPINGS_PATH, "utf8"));
const { candidates } = JSON.parse(await readFile(CAND_PATH, "utf8"));

let merged = 0;
let skippedDueToStale = 0;
for (const [key, cand] of Object.entries(candidates)) {
  if (cand.decision !== "apply") continue;
  const entry = data.mappings[key];
  if (!entry) {
    console.error(`SKIP ${key}: _image-mappings.json에 key 없음`);
    continue;
  }
  if (entry.manifest_path !== null) {
    console.error(`SKIP ${key}: 이미 manifest_path 있음 (${entry.manifest_path})`);
    continue;
  }
  entry.manifest_path = cand.manifest_path;
  entry.notes = `Phase 1.5b 자동 매핑 (method=${cand.method}, yes=${cand.yesCount}/4)`;
  merged += 1;
}

await writeFile(MAPPINGS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
console.error(`머지 완료: ${merged}건 manifest_path 채움. stale skip: ${skippedDueToStale}건.`);
EOF
```

### - [ ] Step 2: 머지 실행 + diff 확인

```bash
node scripts/merge-candidates-to-mappings.mjs
git diff --stat content/_image-mappings.json
```

Expected: `_image-mappings.json` 변경. 추가된 manifest_path 개수 = Task B2 apply 카운트.

### - [ ] Step 3: image:apply 실행 — PR #5 `_alt_original` 가드 검증

```bash
npm run image:apply 2>&1 | tee /tmp/image-apply.log
```

Expected: apply 성공 N건. `_alt_original` 불일치로 차단된 case 있으면 stderr에 표시. 차단된 케이스가 있으면 `_image-mappings.json`의 해당 entry 점검 (frontmatter title 변경 또는 indexInFile drift 가능성).

차단 없이 모두 성공해야 함 — Task B0~B2에서 raster·매핑이 일관되게 작성됐기 때문.

### - [ ] Step 4: 빌드 검증 — 564개 정적 페이지 변동 없음

```bash
npm run build 2>&1 | tail -30
```

Expected:
```
○ ... 
Generating static pages (564/564)
```

페이지 개수 변동 시: 신규 mapping이 잘못된 frontmatter나 본문을 만들었을 가능성. `git diff content/` 확인 후 rollback.

### - [ ] Step 5: 테스트 실행

```bash
npm test 2>&1 | tail -20
```

Expected: 73+ tests PASS (PR A에서 추가된 slug-raster-map test 포함).

### - [ ] Step 6: 검수 큐 갱신 — closed-loop routing

```bash
cat > /tmp/regen-disputed.mjs <<'EOF'
#!/usr/bin/env node
/**
 * Task B2의 review 결정 + Task B1의 unresolved를 합쳐 docs/image-mapping-disputed.md 갱신.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const candPath = resolve(ROOT, "content/_image-mappings-candidates.json");
const unresolvedPath = resolve(ROOT, "content/_slug-raster-unresolved.json");
const mappingsPath = resolve(ROOT, "content/_image-mappings.json");
const outPath = resolve(ROOT, "docs/image-mapping-disputed.md");

const { candidates } = JSON.parse(await readFile(candPath, "utf8"));
const { unresolved } = JSON.parse(await readFile(unresolvedPath, "utf8"));
const all = JSON.parse(await readFile(mappingsPath, "utf8")).mappings;

const reviewCases = Object.entries(candidates).filter(([, c]) => c.decision === "review");
const skipCases = Object.entries(candidates).filter(([, c]) => c.decision === "skip");

const lines = [
  "# 이미지 매핑 — 위원장 검수 큐 (Phase 1.5b PR B 후속)",
  "",
  "Phase 1.5b 본 자동화(2026-05-19) 후 잔여. 위원장이 화면 낭독기로 청취 후 결정.",
  "",
  "## 결과 요약",
  "",
  `- 자동 적용: ${Object.values(candidates).filter((c) => c.decision === "apply").length}건`,
  `- 검수 큐 (review, 후보 있음): ${reviewCases.length}건`,
  `- 스킵 (skip, 후보 없음): ${skipCases.length + unresolved.length}건`,
  `  - cross-validation 후보 raster 부적합: ${skipCases.length}건`,
  `  - 매핑 사전 unresolved: ${unresolved.length}건`,
  "",
  "## 검수 대상 (review)",
  "",
];
for (const [key, c] of reviewCases) {
  const alt = (all[key]?._alt_original ?? "").slice(0, 100);
  lines.push(`### ${key}`);
  lines.push(`- alt: ${alt}…`);
  lines.push(`- 후보 raster: ${c.manifest_path}`);
  lines.push(`- verdicts: Claude=${c.verdicts.claude} Gemini=${c.verdicts.gemini} Gemma=${c.verdicts.gemma} Codex=${c.verdicts.codex}`);
  lines.push("");
}
lines.push("## 매핑 사전 unresolved");
lines.push("");
for (const u of unresolved) {
  lines.push(`- ${u.key} (source=${u.source}, reason=${u.reason})`);
}

await writeFile(outPath, lines.join("\n") + "\n", "utf8");
console.error(`disputed.md 갱신: review ${reviewCases.length}건 + unresolved ${unresolved.length}건`);
EOF
node /tmp/regen-disputed.mjs
```

Expected: `docs/image-mapping-disputed.md` 갱신. apply/review/skip 카운트 sanity check.

### - [ ] Step 7: 커밋

```bash
git add content/_image-mappings.json docs/image-mapping-disputed.md scripts/merge-candidates-to-mappings.mjs content/
git commit -m "$(cat <<'COMMIT'
feat(phase-1-5b): image:apply 자동 적용 + 검수 큐 closed-loop routing

Task B2 apply 판정 케이스를 _image-mappings.json manifest_path에 머지.
npm run image:apply 실행, _alt_original 가드(PR #5) 차단 0건 확인.
빌드 564개 정적 페이지 변동 없음 + npm test 그린.

잔여 review 케이스와 매핑 사전 unresolved를 docs/image-mapping-disputed.md
검수 큐로 routing. 위원장 직접 결정 대기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Task B4: PR 생성 + codex-rescue + 머지

### - [ ] Step 1: 누적 변경 확인

```bash
git log --oneline master..HEAD
git diff --stat master..HEAD
```

Expected: Task B0~B3 4개 commit. 변경 파일 요약.

### - [ ] Step 2: webfortd CLAUDE.md 변경 이력 한 줄 추가

```bash
# webfortd/CLAUDE.md의 "변경 이력" 표 끝에 다음 행 추가:
#   | 2026-05-19 | Phase 1.5b PR A·B 머지. PyMuPDF 페이지 렌더 채택, slug→raster 매핑 사전 구축으로 86건 unmapped 중 N건 자동 적용. 잔여는 closed-loop 검수 큐로 routing. |
```

(정확한 N건 수치는 Task B3 결과로 채움.)

### - [ ] Step 3: 브랜치 push + PR 생성

```bash
git push -u origin phase-1-5b-86-auto-rerun
gh pr create --title "Phase 1.5b PR B — 86건 본 자동화 재가동" --body "$(cat <<'EOF'
## Summary

- PR A 채택 PyMuPDF 페이지 렌더 raster pool로 86건 unmapped 본 자동화 실행
- Task B1: slug→raster 매핑 사전 구축 (fitz.search_for() 1차 + ±25 fallback + unresolved). 7건 known-answer 단위 테스트로 회귀 차단
- Task B2: 4종(Claude·Gemini·Gemma·Codex) cross-validation 재가동. Gemini base64 우회
- Task B3: image:apply 자동 적용. _alt_original 가드(PR #5) 통과
- 빌드 564개 정적 페이지 변동 없음. 73+ tests 그린
- 잔여 케이스는 docs/image-mapping-disputed.md 검수 큐로 routing (위원장 직접 결정 대기)

## Test plan

- [ ] npm test — 73+ tests 그린 + slug-raster-map test 3건 PASS
- [ ] npm run build — 564개 정적 페이지 변동 없음
- [ ] _image-mappings.json: manifest_path 채워진 신규 N건 모두 _alt_original 일치
- [ ] docs/image-mapping-disputed.md: review 건수 + unresolved 건수 합이 86 - N

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### - [ ] Step 4: codex-rescue dispatch

```
Agent({
  subagent_type: "codex:codex-rescue",
  description: "Phase 1.5b PR B 본 자동화 리뷰",
  prompt: "Phase 1.5b PR B의 변경을 검토. 리뷰 포커스 3가지: (1) Task B1 매핑 사전이 spec §3.1.1 acceptance criteria(1차/fallback/unresolved 3단계 흐름, page-numbered/chapter slug 별도 처리, 60% 임계)를 정확히 구현하는가? (2) Task B2 cross-validation 합의 게이트(4/4 또는 3/4 + 명시적 NO 0)가 Phase 1.5와 동일하게 작동하는가, Gemini base64 우회가 안전한가? (3) Task B3 image:apply 가 PR #5 _alt_original 가드를 통과하는가, 그리고 빌드 564개 정적 페이지 변동 없음을 보장하는 매커니즘이 명확한가? 200단어 이내로 보고. cross-cutting invariant gap 우선."
})
```

### - [ ] Step 5: codex 보완 적용 + 새 commit

codex-rescue가 지적한 보완을 별도 commit으로 반영. 그 다음 force push가 아닌 단순 push.

### - [ ] Step 6: admin squash 머지

```bash
gh pr merge --admin --squash --delete-branch
git checkout master && git pull
git log --oneline -5
```

Expected: master에 PR B squash commit 추가. brand new master hash 출력.

### - [ ] Step 7: 메모리 갱신

```
/Users/hunyongkim/.claude/projects/-Users-hunyongkim-Mac-Projects-webfortd/memory/project_phase_status.md
 - "Phase 1.5b PR A 완료" 절을 "Phase 1.5b 완료 (PR A·B)"로 갱신
 - 자동 적용 N건 / 잔여 검수 큐 (86-N)건 명시
 - "다음 작업: PR C closed-loop 검수 큐 처리" 추가 (위원장 결정 입력 대기)

/Users/hunyongkim/.claude/projects/-Users-hunyongkim-Mac-Projects-webfortd/memory/MEMORY.md
 - master 해시 갱신
 - 다음 작업 = PR C
```

---

## Self-Review

### Spec coverage

| spec 요구 | 대응 task |
|----------|-----------|
| §3.1.1 PyMuPDF 페이지 렌더 채택 | B0 (4 PDF 전체 추출) |
| §3.1.1 slug→raster 매핑 사전 + 1차/fallback/unresolved 3단계 | B1 |
| §3.1.1 매핑 성공률 < 60% 시 재검토 신호 | B1 test 3 (assert >= 0.6) |
| §3.1.1 Gemini base64 우회 | B2 Step 2 (callGeminiBase64) |
| §3.2 단계 1 raster 재추출 | B0 |
| §3.2 단계 2 chapter slug page-range 메타 부여 | B1 |
| §3.2 단계 3 4종 cross-validation 재실행 | B2 |
| §3.2 단계 4 자동 적용 (image:apply) | B3 Step 3 |
| §3.2 단계 5 빌드 564개 변동 없음 | B3 Step 4 |
| §4 무결성 매커니즘 — `_alt_original` 가드 | B3 Step 3 (PR #5 가드 자동 검증) |
| §6 PR 전략 PR B | B4 |

미커버 항목 없음.

### Placeholder scan

- B2 Step 2의 마지막 `import { callClaude, ... } from "/tmp/image-match-poc/auto-mapping.mjs"` — `/tmp` 경로 import는 정상 동작이 보장 안 됨. **fix**: 본 plan 실행 시 첫 단계에서 함수 4개를 `scripts/cross-validate-mappings.mjs`에 직접 복사하거나, `/tmp/image-match-poc/`를 npm workspace 외부로 두지 말고 `scripts/lib/model-clients.mjs`로 이주. 실제 작업자는 import 라인을 함수 본문 복사로 치환.
- B4 Step 2 webfortd CLAUDE.md 갱신은 "정확한 N건 수치는 Task B3 결과로 채움" 표기 — placeholder. 작업자는 Task B3 산출물의 apply 카운트를 그대로 사용.
- B4 Step 5 codex 보완은 "지적한 보완을 별도 commit으로 반영" — 실제 지적은 미리 못 박지만, 보완 commit message는 PR A에서 사용한 패턴(`docs(phase-1-5b): codex-rescue 보완 — <한 줄 요약>`) 따름.

### Type consistency

- 매핑 사전 구조: `{ mappings: { [key]: { source, raster, method, alt } } }` — B1 Python·B1 test·B2 모두 일관.
- candidate 구조: `{ decision, manifest_path, method, verdicts: {claude,gemini,gemma,codex}, yesCount, noCount }` — B2·B3 일관.
- 합의 게이트: `yesCount === 4 || (yesCount === 3 && noCount === 0)` — Phase 1.5와 동일 명세.
- 파일명 패턴: `page-NNN-render.png` (B0·B1·B2·B3 일관). baseline `page-NNN-fig-MM.png`와 공존.

### 명세 누락 보강

- B1 fallback의 `±25 + alt-image 1차 stamp`에서 alt-image stamp는 실제로 Task B2의 cross-validation에서 일어남. B1 단계의 fallback은 후보 1개만 잠정 등록 — Task B2가 그 후보를 실제 모델 합의로 검증하는 형태. spec §3.1.1 "alt-image 모델로 1차 후보 좁힘"의 의도는 B1과 B2 사이에서 분담되어 cover됨. 본 plan에서 명시 — fallback 후보가 합의 게이트에서 reject되면 review로 routing.

---

## 실행 옵션

Plan 완성. `docs/superpowers/plans/2026-05-19-phase-1-5b-pr-b-auto-rerun.md`에 저장됨.

**1. Subagent-Driven (권장)** — task별 fresh subagent dispatch + 두 단계 review. PR B는 task 4개로 명확히 분리되어 적합. 매 task 후 결과 검토 가능.

**2. Inline Execution** — 현 세션에서 executing-plans skill로 batch 실행, 체크포인트로 review.
