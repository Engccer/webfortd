#!/usr/bin/env python3
"""PDF에서 raster 이미지를 추출해 source별 이미지 폴더와 manifest를 갱신한다."""

from __future__ import annotations

import argparse
import io
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT_DIR / "data" / "source-pdf"
OUTPUT_ROOT = ROOT_DIR / "public" / "source-images"
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"
TRIM_FOOTER_PX = 60
MIN_IMAGE_SIZE_PX = 50

SOURCE_MAP = {
    "2023 장애유형별 장애인교원 근무 지원 방안_최종보고서.pdf": "2023-disability-types-work-support-report",
    "2023 장애인교원 인사관리 안내서.pdf": "2023-hr-guide",
    "241210_책자_내지_중부대학교_장애인교원_근무지원_안내자료_V4.pdf": "2024-jbu-work-support-guide",
    "내지_장애인교원_지원인력_직무_수행_안내자료인쇄용_156P_수정.pdf": "2024-support-staff-duty-guide",
}


def log(message: str) -> None:
    print(message, file=sys.stderr)


def ensure_package(import_name: str, package_name: str, required: bool) -> Any | None:
    try:
        return __import__(import_name)
    except ImportError:
        log(f"{package_name} 미설치: pip --user 설치를 시도합니다.")

    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", package_name],
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        message = f"{package_name} 설치 실패: {exc}"
        if required:
            raise SystemExit(message) from exc
        log(message)
        return None

    try:
        return __import__(import_name)
    except ImportError as exc:
        message = f"{package_name} 설치 후에도 import 실패: {exc}"
        if required:
            raise SystemExit(message) from exc
        log(message)
        return None


def load_pillow_image_module() -> Any | None:
    try:
        from PIL import Image

        return Image
    except ImportError:
        ensure_package("PIL", "Pillow", required=False)
        try:
            from PIL import Image

            return Image
        except ImportError as exc:
            log(f"Pillow를 사용할 수 없어 원본 bytes 저장으로 진행합니다: {exc}")
            return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="webfortd source PDF 이미지 추출")
    parser.add_argument("--pdf", type=Path, help="단일 PDF 경로")
    parser.add_argument(
        "--alt",
        action="store_true",
        help="이미지별 alt 생성 명령을 실행해 stdout을 alt 필드에 저장",
    )
    return parser.parse_args()


def resolve_pdf_paths(pdf_arg: Path | None) -> list[Path]:
    if pdf_arg:
        pdf_path = pdf_arg.expanduser().resolve()
        if pdf_path.name not in SOURCE_MAP:
            raise SystemExit(f"알 수 없는 PDF 파일명입니다: {pdf_path.name}")
        if not pdf_path.exists():
            raise SystemExit(f"PDF 파일이 없습니다: {pdf_path}")
        return [pdf_path]

    paths = [PDF_DIR / filename for filename in SOURCE_MAP]
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        raise SystemExit("PDF 파일이 없습니다:\n" + "\n".join(missing))
    return paths


def image_is_in_footer(rects: list[Any], page_height: float) -> bool:
    footer_top = page_height - TRIM_FOOTER_PX
    return any(rect.y1 >= footer_top for rect in rects)


def get_image_rects(page: Any, item: tuple[Any, ...], xref: int) -> list[Any]:
    try:
        rect = page.get_image_bbox(item)
        if rect and not rect.is_empty and not rect.is_infinite:
            return [rect]
    except Exception:
        pass

    try:
        return list(page.get_image_rects(xref))
    except Exception:
        return []


def write_png_or_raw(image_info: dict[str, Any], output_path: Path, pillow_image: Any | None) -> None:
    image_bytes = image_info["image"]
    if pillow_image is None:
        output_path.write_bytes(image_bytes)
        return

    try:
        with pillow_image.open(io.BytesIO(image_bytes)) as image:
            # PNG 호환성이 낮은 모드는 RGB/RGBA로 정규화한다.
            if image.mode not in {"1", "L", "LA", "P", "RGB", "RGBA"}:
                image = image.convert("RGBA" if "A" in image.mode else "RGB")
            image.save(output_path, format="PNG")
    except Exception as exc:
        log(f"PNG 변환 실패, 원본 bytes 저장: {output_path.name}: {exc}")
        output_path.write_bytes(image_bytes)


def generate_alt(output_path: Path) -> str | None:
    command = os.environ.get("PDF_IMAGE_ALT_COMMAND")
    if not command:
        log("--alt가 지정됐지만 PDF_IMAGE_ALT_COMMAND가 없어 alt=null로 저장합니다.")
        return None

    try:
        result = subprocess.run(
            [command, str(output_path)],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except Exception as exc:
        log(f"alt 생성 실패: {output_path.name}: {exc}")
        return None

    alt = result.stdout.strip()
    return alt or None


def extract_pdf_images(pdf_path: Path, fitz: Any, pillow_image: Any | None, with_alt: bool) -> list[dict[str, Any]]:
    source = SOURCE_MAP[pdf_path.name]
    source_dir = OUTPUT_ROOT / source
    source_dir.mkdir(parents=True, exist_ok=True)

    log(f"처리 시작: {pdf_path.name} -> {source}")
    entries: list[dict[str, Any]] = []

    with fitz.open(pdf_path) as doc:
        for page_index, page in enumerate(doc, start=1):
            page_figure = 0
            images = page.get_images(full=True)
            if not images:
                continue

            seen_xrefs: set[int] = set()
            for item in images:
                xref = int(item[0])
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)

                rects = get_image_rects(page, item, xref)
                if not rects:
                    continue
                if image_is_in_footer(rects, page.rect.height):
                    continue

                try:
                    image_info = doc.extract_image(xref)
                except Exception as exc:
                    log(f"이미지 추출 실패: {source} page {page_index} xref {xref}: {exc}")
                    continue

                width = int(image_info.get("width") or 0)
                height = int(image_info.get("height") or 0)
                if width < MIN_IMAGE_SIZE_PX or height < MIN_IMAGE_SIZE_PX:
                    continue

                page_figure += 1
                filename = f"page-{page_index:03d}-fig-{page_figure:02d}.png"
                output_path = source_dir / filename
                write_png_or_raw(image_info, output_path, pillow_image)

                relative_path = output_path.relative_to(ROOT_DIR).as_posix()
                entries.append(
                    {
                        "source": source,
                        "page": page_index,
                        "figure": page_figure,
                        "path": relative_path,
                        "alt": generate_alt(output_path) if with_alt else None,
                    }
                )

            if page_figure:
                log(f"  page {page_index:03d}: {page_figure}개")

    log(f"처리 완료: {source}: {len(entries)}개")
    return entries


def load_manifest() -> list[dict[str, Any]]:
    if not MANIFEST_PATH.exists():
        return []
    try:
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"manifest.json 파싱 실패: {exc}") from exc
    if not isinstance(data, list):
        raise SystemExit("manifest.json 루트가 배열이 아닙니다.")
    return data


def save_manifest_atomic(entries: list[dict[str, Any]]) -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    temp_path = MANIFEST_PATH.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp_path.replace(MANIFEST_PATH)


def main() -> int:
    args = parse_args()
    fitz = ensure_package("fitz", "PyMuPDF", required=True)
    pillow_image = load_pillow_image_module()
    pdf_paths = resolve_pdf_paths(args.pdf)
    processed_sources = {SOURCE_MAP[path.name] for path in pdf_paths}

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    new_entries: list[dict[str, Any]] = []
    for pdf_path in pdf_paths:
        new_entries.extend(extract_pdf_images(pdf_path, fitz, pillow_image, args.alt))

    manifest_entries = [
        entry for entry in load_manifest() if entry.get("source") not in processed_sources
    ]
    manifest_entries.extend(new_entries)
    manifest_entries.sort(key=lambda entry: (entry["source"], entry["page"], entry["figure"]))
    save_manifest_atomic(manifest_entries)

    counts = {source: 0 for source in sorted(processed_sources)}
    for entry in new_entries:
        counts[entry["source"]] = counts.get(entry["source"], 0) + 1

    print(f"extracted_total={len(new_entries)}")
    print(f"manifest_total={len(manifest_entries)}")
    for source in sorted(counts):
        print(f"{source}={counts[source]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
