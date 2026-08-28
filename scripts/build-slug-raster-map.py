#!/usr/bin/env python3
"""slug→raster index 매핑 사전 구축. ⚠ v3 이미지 매핑 자산(2026-08-29 3층 재생성으로 content/_archive-v3/에 보존, 읽기 전용).

알고리즘 (controller 사전 조사 후 plan §3.1.1에 더해 보강):
1. KNOWN_ANSWERS (7건 ground truth, PR A A8 검증): hardcode 매핑
2. page-numbered slug 1차: slug 번호 N에 대해 raster page-NNN-render.png 잠정 등록
   (실제 정답은 Task B2 cross-validation이 ±25 window에서 최종 선정)
3. chapter slug 1차: frontmatter title을 PDF text에서 search_for. 못 찾으면 unresolved.
4. unresolved JSON 분리 — closed-loop 검수 큐 routing.

출력:
- content/_archive-v3/_slug-raster-map.json
- content/_archive-v3/_slug-raster-unresolved.json

acceptance: 매핑 성공률 >= 60% (test에서 강제).
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
MAPPINGS_PATH = CONTENT_DIR / "_archive-v3" / "_image-mappings.json"
MAP_OUT = CONTENT_DIR / "_archive-v3" / "_slug-raster-map.json"
UNRESOLVED_OUT = CONTENT_DIR / "_archive-v3" / "_slug-raster-unresolved.json"

SOURCE_TO_PDF = {
    "2023-disability-types-work-support-report": "2023 장애유형별 장애인교원 근무 지원 방안_최종보고서.pdf",
    "2023-hr-guide": "2023 장애인교원 인사관리 안내서.pdf",
    "2024-jbu-work-support-guide": "241210_책자_내지_중부대학교_장애인교원_근무지원_안내자료_V4.pdf",
    "2024-support-staff-duty-guide": "내지_장애인교원_지원인력_직무_수행_안내자료인쇄용_156P_수정.pdf",
}

PAGE_NUMBER_RE = re.compile(r"^(?P<prefix>.+?)-p-(?P<num>\d{3})$")

# KNOWN_ANSWERS: PR A Task A8 시뮬레이션에서 3종 모델 7/7 YES 만장일치로 검증된 ground truth.
# /tmp/image-match-poc/sample-results-summary.md §2 참조.
KNOWN_ANSWERS = {
    "2023-hr-p-046#2023-hr-guide#0": ("2023-hr-guide", "page-024-render.png"),
    "2023-hr-p-052#2023-hr-guide#0": ("2023-hr-guide", "page-046-render.png"),
    "2023-hr-p-052#2023-hr-guide#1": ("2023-hr-guide", "page-046-render.png"),
    "2023-hr-p-052#2023-hr-guide#2": ("2023-hr-guide", "page-046-render.png"),
    "2023-hr-p-057#2023-hr-guide#0": ("2023-hr-guide", "page-060-render.png"),
    "2023-hr-p-057#2023-hr-guide#1": ("2023-hr-guide", "page-060-render.png"),
    "2024-staff-p-023#2024-support-staff-duty-guide#0": ("2024-support-staff-duty-guide", "page-025-render.png"),
}


def load_unmapped_keys() -> list[dict[str, Any]]:
    """_image-mappings.json에서 manifest_path null인 86건 추출."""
    data = json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
    keys: list[dict[str, Any]] = []
    for key, entry in data["mappings"].items():
        if entry.get("manifest_path") is not None:
            continue
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
    full = ROOT / file_path
    if not full.exists():
        return ""
    text = full.read_text(encoding="utf-8")
    m = re.search(r"^title:\s*(.+)$", text, re.MULTILINE)
    return m.group(1).strip().strip("\"'") if m else ""


def normalize_title(title: str) -> list[str]:
    """alias/normalized-title 후보 생성."""
    candidates = [title]
    stripped = re.sub(r"^(?:\d+[\.\)\s]+|<[^>]+>\s*|[■□●○]\s*)", "", title)
    if stripped and stripped != title:
        candidates.append(stripped)
    compact = re.sub(r"\s+", "", title)
    if compact != title:
        candidates.append(compact)
    sym_free = re.sub(r"[·…\(\)\[\]「」『』]", "", title)
    if sym_free != title:
        candidates.append(sym_free)
    return list(dict.fromkeys(c for c in candidates if c.strip()))


def search_text_in_pdf(doc: fitz.Document, queries: list[str]) -> int | None:
    for page_num in range(len(doc)):
        text = doc[page_num].get_text()
        for q in queries:
            if q and q in text:
                return page_num
    return None


def build_map() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    mappings: dict[str, Any] = {}
    unresolved: list[dict[str, Any]] = []
    keys = load_unmapped_keys()
    print(f"unmapped 86건 입력: {len(keys)}건", file=sys.stderr)

    docs: dict[str, fitz.Document] = {}

    for k in keys:
        source = k["source_slug"]

        # 0) KNOWN_ANSWERS hardcode
        if k["key"] in KNOWN_ANSWERS:
            ans_source, ans_raster = KNOWN_ANSWERS[k["key"]]
            mappings[k["key"]] = {
                "source": ans_source,
                "raster": ans_raster,
                "method": "known_answer",
                "alt": k["alt"][:80],
            }
            continue

        # PDF lazy open
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

        # 1) page-numbered slug — slug 번호 N으로 page-NNN-render.png 잠정 등록
        m = PAGE_NUMBER_RE.match(k["file_slug"])
        if m:
            slug_num = int(m.group("num"))
            if 1 <= slug_num <= len(doc):
                mappings[k["key"]] = {
                    "source": source,
                    "raster": f"page-{slug_num:03d}-render.png",
                    "method": "page_number_seed",
                    "alt": k["alt"][:80],
                }
            else:
                unresolved.append({"key": k["key"], "source": source, "reason": f"slug_num {slug_num} out of pdf range {len(doc)}"})
            continue

        # 2) chapter slug — frontmatter title PDF text search
        title = load_frontmatter_title(k["file_path"])
        if not title:
            unresolved.append({"key": k["key"], "source": source, "reason": "frontmatter title 없음"})
            continue
        idx = search_text_in_pdf(doc, [title])
        method = "primary"
        if idx is None:
            idx = search_text_in_pdf(doc, normalize_title(title))
            method = "fallback"
        if idx is None:
            unresolved.append({"key": k["key"], "source": source, "reason": "chapter title PDF text 매칭 실패"})
            continue
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
    method_counts: dict[str, int] = {}
    for v in mappings.values():
        method_counts[v["method"]] = method_counts.get(v["method"], 0) + 1
    print(f"매핑 사전: {len(mappings)}건 ({method_counts})", file=sys.stderr)
    print(f"unresolved: {len(unresolved)}건", file=sys.stderr)
    print(f"매핑 성공률: {rate*100:.1f}% (spec §3.1.1 60% 임계)", file=sys.stderr)
    return 0 if rate >= 0.6 else 1


if __name__ == "__main__":
    sys.exit(main())
