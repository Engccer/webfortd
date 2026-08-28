#!/usr/bin/env python3
"""인쇄 책자 3종(2023 인사관리 안내서·2024 단위학교·2024 지원인력)의 hwpx_enrich 출력 후처리.

hwpx_enrich가 스타일·정규식으로 못 거르는, 인쇄 책자 특유의 장식 요소를 결정론 규칙으로 걷어낸다.
  ① 부(PART) 간지: 로마 숫자만 든 행을 가진 레이아웃 표. 표의 로마 숫자·제목으로 그 자리에 H1을 만들고
     (바로 뒤의 맨 제목 줄을 H1으로 바꾼다), 구역 머리말에서 온 같은 문구의 H1(구역 나누기 위치 = 본문 중간에
     찍히므로 부 시작 위치가 아니다)은 지운다
  ⑤ 목차 줄 끝 쪽 번호 제거(초안 페이지네이션이라 인쇄본과 다르다) · 표지의 초안 표시 줄·표 삭제
  ② 배경·장식 이미지 참조(대체텍스트가 없는 것은 삭제, 있으면 "(이미지: …)"로 치환)
  ③ 집필·검토진 명단 표와 판권(발행처·디자인) 표 — 2026-08-28 위원장 결정(실명 명단은 정본에서 제외)
  ④ 표기 노이즈: 「< 표」·「< 그림」 여는 괄호 뒤 공백, 가운뎃점(·ㆍ‧) 앞뒤 공백, 심볼 글꼴 PUA 글리프(→·↓·□)
본문 글자는 ④ 외에는 바꾸지 않는다. 삭제한 표·줄은 보고서(JSON)에 남긴다.
"""
import argparse
import json
import re
import sys

ROMAN = {"I": "Ⅰ", "II": "Ⅱ", "III": "Ⅲ", "IV": "Ⅳ", "V": "Ⅴ", "Ⅰ": "Ⅰ", "Ⅱ": "Ⅱ", "Ⅲ": "Ⅲ", "Ⅳ": "Ⅳ", "Ⅴ": "Ⅴ", "Ⅵ": "Ⅵ", "Ⅶ": "Ⅶ"}
DRAFT = re.compile(r"초안|검토용|검토안|수정안|무단복제")
CREDIT_FIRST = {"총괄", "기획", "연구", "검토", "집필", "감수", "자문", "발행", "편집"}
COLOPHON = re.compile(r"발\s*행\s*처|디\s*자\s*인\s*:|인쇄<br>|발행$|ISBN")
DOT = re.compile(r"(?<=[가-힣A-Za-z0-9)\]）】]) ?([·ㆍ‧]) ?(?=[가-힣A-Za-z0-9(\[（【])")
# 심볼 글꼴(Wingdings 계열) 사용자 정의 영역 글리프: 화면에서만 화살표·상자로 보이고 텍스트로는 빈 칸이다
PUA = {"\uf0e8": "→", "\U000f003b": "↓", "\uf0fe": "□"}


def is_row(line):
    return line.startswith("| ") and line.endswith(" |")


CELL_SPLIT = re.compile(r"(?<!\\) \| ")  # hwpx_enrich.py와 같은 규칙: 셀 안의 \| 는 구분자가 아니다


def cells(line):
    return [c.strip() for c in CELL_SPLIT.split(line[2:-2])]


def table_blocks(lines):
    i = 0
    while i < len(lines):
        if is_row(lines[i]):
            j = i
            while j < len(lines) and is_row(lines[j]):
                j += 1
            yield i, j
            i = j
        else:
            i += 1


def norm(s):
    return re.sub(r"\s+", "", s.replace("<br>", "").replace("ㆍ", "·").replace("‧", "·"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--image-alt", default="{}", help='JSON 문자열 또는 @파일경로. {"image4.JPG": "대체텍스트" | null(삭제) | {"block": "전사 블록"}}')
    ap.add_argument("--keep-credits", action="store_true", help="집필진·판권 표를 지우지 않는다")
    ap.add_argument("--drop-section-regex", default="", help="이 정규식에 맞는 제목 줄부터 다음 제목(#) 또는 <목 차> 전까지 삭제(초안에만 있는 절)")
    args = ap.parse_args()
    alts = json.load(open(args.image_alt[1:], encoding="utf-8")) if args.image_alt.startswith("@") else json.loads(args.image_alt)
    lines = open(args.inp, encoding="utf-8").read().split("\n")
    drop = set()
    pua_counts = {f"U+{ord(ch):X}": sum(l.count(ch) for l in lines) for ch in PUA}
    for ch, rep_ch in PUA.items():
        lines = [l.replace(ch, rep_ch) for l in lines]
    report = {"pua_glyphs": pua_counts,
              "part_divider_tables": 0, "part_h1": [], "removed_header_h1": [], "toc_pages_stripped": 0, "draft_marks": [],
              "images": {}, "credits_tables": [], "dot_spacing": 0, "table_caption_space": 0}
    replace = {}  # line_idx -> 새 줄
    kept_h1 = set()  # 간지 바로 뒤에 이미 제자리에 있던 H1
    toc_start = lines.index("<목 차>") if "<목 차>" in lines else None

    # 간지 표마다 반복되는 셀(책 제목)은 부 제목 후보에서 뺀다(간지가 2개 이상일 때만 판정 가능)
    blocks = list(table_blocks(lines))
    divider_cell_sets = []
    for i, j in blocks:
        rows = [[c for c in cells(l) if c] for l in lines[i:j] if not l.startswith("| --- ")]
        if any(r and all(c in ROMAN for c in r) for r in rows):
            divider_cell_sets.append({norm(c) for r in rows for c in r if c not in ROMAN})
    common_cells = set.intersection(*divider_cell_sets) if len(divider_cell_sets) >= 2 else set()
    # ① 간지 표 / ③ 집필진·판권 표
    for i, j in blocks:
        rows = [cells(l) for l in lines[i:j] if not l.startswith("| --- ")]
        nonempty_rows = [[c for c in r if c] for r in rows]
        # 부록 간지 표: 모든 셀(줄바꿈 조각)이 「<부록N> …」·「[부록 N] …」이면 레이아웃 표
        parts = [seg.strip() for r in nonempty_rows for c in r for seg in c.split("<br>") if seg.strip()]
        is_app = lambda x: re.match(r"^(<부록\s?\d+>|\[부록\s?\d+\])", x)
        if parts and any(is_app(x) for x in parts) and all(is_app(x) or x == "부록" or norm(x) in common_cells for x in parts):
            drop.update(range(i, j))
            report["part_divider_tables"] += 1
            continue
        roman = next((ROMAN[r[0]] for r in nonempty_rows if r and all(c in ROMAN for c in r)), None)
        if roman:
            drop.update(range(i, j))
            report["part_divider_tables"] += 1
            # 부 제목 = 표 뒤 6줄 안의 맨 제목 줄과 같은 문구의 셀(책 제목 셀은 맨 줄로 반복되지 않는다).
            # 그 맨 줄을 H1로 바꾼다. 일치하는 줄이 없으면 만들지 않고 보고만 한다(추론으로 제목을 지어내지 않는다)
            cell_keys = {norm(c) for r in nonempty_rows for c in r if c not in ROMAN}
            placed = None
            stray = []
            for k in range(j, min(len(lines), j + 7)):
                l = lines[k]
                if not l or l.startswith("<!--") or k in drop or is_row(l):
                    continue
                key = norm(re.sub(r"^#+\s*([ⅠⅡⅢⅣⅤⅥⅦ]\.\s*)?", "", l))
                if key in cell_keys:
                    placed = key
                    if l.startswith("#"):
                        kept_h1.add(k)
                        drop.update(stray)  # 간지 표와 H1 사이의 맨 제목 잔여 줄(표기만 다른 것)
                        report.setdefault("part_stray_lines", []).extend(lines[x] for x in stray)
                    else:
                        replace[k] = f"# {roman}. {l.strip()}"
                    break
                if l.startswith("#"):
                    break
                stray.append(k)
            if not placed:
                # 맨 제목 줄이 없으면 본문 중간(구역 나누기 위치)에 찍힌 같은 문구의 머리말 H1을 이 자리로 옮긴다
                for k in range(j, len(lines)):
                    if lines[k].startswith("# ") and norm(re.sub(r"^# [ⅠⅡⅢⅣⅤⅥⅦ]\.\s*", "", lines[k])) in cell_keys:
                        replace[j - 1] = lines[k] if re.match(r"^# [ⅠⅡⅢⅣⅤⅥⅦ]\.", lines[k]) else f"# {roman}. {lines[k][2:]}"
                        drop.discard(j - 1)
                        placed = norm(re.sub(r"^# [ⅠⅡⅢⅣⅤⅥⅦ]\.\s*", "", lines[k]))
                        report.setdefault("part_h1_moved", []).append(lines[k])
                        break
            if not placed and len(divider_cell_sets) >= 2:
                # 머리말 H1도 없으면 간지 표의 부 제목 셀로 만든다. 책 제목 셀은 간지마다 반복되므로 간지가
                # 2개 이상일 때만 구분할 수 있다(1개뿐이면 만들지 않고 unplaced로 보고한다)
                cand = [c for r in nonempty_rows for c in r if c not in ROMAN and norm(c) not in common_cells]
                if cand:
                    shown = " ".join(max(cand, key=len).replace("<br>", " ").split())
                    replace[j - 1] = f"# {roman}. {shown}"
                    drop.discard(j - 1)
                    placed = norm(shown)
                    report.setdefault("part_h1_from_cell", []).append(f"{roman}. {shown}")
            if placed:
                report["part_h1"].append(f"{roman}. {placed}")
            else:
                report.setdefault("part_h1_unplaced", []).append(f"{roman}: {sorted(cell_keys)[:3]}")
            continue
        if args.keep_credits:
            continue
        firsts = [r[0] for r in nonempty_rows if r]
        credit_rows = sum(1 for f in firsts if f in CREDIT_FIRST)
        flat = " ".join(" ".join(r) for r in rows)
        if (credit_rows >= 3 and credit_rows >= len(firsts) * 0.6) or COLOPHON.search(flat):
            drop.update(range(i, j))
            report["credits_tables"].append(" / ".join(sorted({c for r in nonempty_rows for c in r}))[:200])

    # ① 구역 머리말에서 온 H1: 간지로 만든 H1과 같은 문구면 위치와 상관없이 삭제
    made = {t.split(". ", 1)[1] for t in report["part_h1"]}
    for i, line in enumerate(lines):
        if i in replace or i in drop or i in kept_h1 or not line.startswith("# "):
            continue
        if norm(re.sub(r"^# [ⅠⅡⅢⅣⅤⅥⅦ]\.\s*", "", line)) in made:
            drop.add(i)
            report["removed_header_h1"].append(line)
    # ⑤ 목차 쪽수 제거 · 표지 초안 표시 삭제
    if toc_start is not None:
        k = toc_start + 1
        while k < len(lines) and lines[k] and not lines[k].startswith("#"):
            new = re.sub(r"\s+\d{1,3}$", "", lines[k])
            if new != lines[k]:
                replace[k] = new
                report["toc_pages_stripped"] += 1
            k += 1
        DRAFT_PHRASE = re.compile(r"(<br>)?\s*\(?(최종\s?검토안|검토안|검토용|수정안)\)?")
        for k in range(0, toc_start):
            if k in drop or not lines[k]:
                continue
            if DRAFT.search(lines[k]):
                stripped = DRAFT_PHRASE.sub("", lines[k])
                if is_row(stripped) and any(c for c in cells(stripped)) and not DRAFT.search(stripped):
                    replace[k] = stripped  # 표지 제목 셀에 덧붙은 「(최종검토안)」만 걷어내고 제목은 남긴다
                    report["draft_marks"].append(f"{lines[k][:60]} → {stripped[:60]}")
                    continue
                drop.add(k)
                report["draft_marks"].append(lines[k][:80])
                if is_row(lines[k]):  # 표 한 줄이면 구분선도 함께
                    for kk in (k - 1, k + 1):
                        if 0 <= kk < len(lines) and lines[kk].startswith("| --- "):
                            drop.add(kk)

    if args.drop_section_regex:
        rx = re.compile(args.drop_section_regex)
        for i, line in enumerate(lines):
            if line.startswith("#") and rx.search(line):
                level = len(line) - len(line.lstrip("#"))
                k = i
                while k < len(lines) and (k == i or not ((lines[k].startswith("#") and len(lines[k]) - len(lines[k].lstrip("#")) <= level) or lines[k] == "<목 차>")):
                    drop.add(k)
                    k += 1
                report.setdefault("dropped_sections", []).append(f"{line} ({k - i}줄)")
    out = []
    for i, line in enumerate(lines):
        if i in drop:
            continue
        line = replace.get(i, line)
        m = re.fullmatch(r"!\[image\]\(([^)]+)\)", line.strip())
        if m:
            key = m.group(1)
            report["images"][key] = report["images"].get(key, 0) + 1
            if key not in alts:  # 명시적 null(삭제 결정)과 누락을 구분한다: 누락은 오류
                sys.exit(f"오류: 이미지 대체 명세 없음: {key} (alts JSON에 null 또는 대체텍스트를 적을 것)")
            alt = alts[key]
            if isinstance(alt, dict) and alt.get("block"):
                # 인쇄본에서 텍스트로 재조판된 그림(표·흐름도 이미지): PDF 원문 전사 블록을 그 자리에 넣는다
                out.extend(alt["block"].rstrip("\n").split("\n"))
            elif alt:
                out.append(f"(이미지: {alt})")
            continue
        line, n = re.subn(r"<\s+(표|그림)", r"<\1", line)
        report["table_caption_space"] += n
        line, n = DOT.subn(r"\1", line)
        report["dot_spacing"] += n
        out.append(line)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(out))
    assert "![image]" not in text
    open(args.out, "w", encoding="utf-8").write(text)
    json.dump(report, open(args.report, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: (v if not isinstance(v, list) else len(v)) for k, v in report.items()}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
