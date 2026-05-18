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
