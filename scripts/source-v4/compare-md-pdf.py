#!/usr/bin/env python3
"""2층 마크다운 정본(또는 HWP 변환본)을 원본 PDF와 대조해 실질 내용 차이를 낸다.

왜 이 도구가 필요한가
---------------------
2026-08-28 실측: 이 문서군은 표가 많아 **연속 문자열 매칭(n-gram)으로는 판정할 수
없다**. HWP는 셀을 논리 순서로, `pdftotext -layout`은 시각 행 순서로 읽어 같은 내용도
문자 시퀀스가 달라진다. 2023 최종보고서에서 25자 창 매칭은 미스가 77%까지 부풀었으나
실제 누락은 0건이었다.

따라서 판정은 두 단계로 한다.
  1. 어절 차집합을 구한다(순서 무관).
  2. 한쪽 전용 어절이 상대 문서 안에 **부분 문자열로 존재하면 조판 줄바꿈으로 잘린
     조각**이므로 제외한다(PDF의 「장애인교」는 「장애인교원」의 일부).
남은 것이 실질 차이다. 2023 최종보고서 기준 0.180%까지 좁혀지며 그 전량이
오탈자 교정·개인정보 삭제·쪽 번호·표 열 접합 유령 어절로 설명됐다.

정규화에서 반드시 걷어낼 것
---------------------------
`<br>`(--cell-br 산물), `<mark>`, `~~`, `<!-- p.NNN -->` 쪽 주석. 특히 `<br>`을
남기면 태그의 "br"이 어절로 잡혀 셀 경계마다 불일치가 생기고 커버리지가 20%p 가까이
왜곡된다.

사용
----
    pdftotext -layout 원본.pdf /tmp/원본.txt
    python compare-md-pdf.py 정본.md /tmp/원본.txt [--top 60]
"""

import argparse
import re
import sys
import unicodedata
from collections import Counter

NON_WORD = re.compile(r"[^가-힣a-zA-Z0-9]")
NOISE = re.compile(r"[|*#`>_=\[\]•·ㆍ○◦□■▶→​‌­]")
TOKEN = re.compile(r"[가-힣]{2,}|[A-Za-z]{3,}|\d{2,}")


def prep(text: str, is_markdown: bool) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)  # 쪽 주석
    if is_markdown:
        text = re.sub(r"<br\s*/?>", " ", text)  # 셀 줄바꿈
        text = re.sub(r"</?mark>|~~", " ", text)  # 변경 표시·취소선
    return NOISE.sub(" ", text)


def split_real(source: Counter, target: Counter, target_core: str):
    """source 전용 어절을 (잘림 조각, 실질 차이)로 가른다."""
    only = set(source) - set(target)
    fragments, real = [], []
    for word in only:
        (fragments if word in target_core else real).append(word)
    return only, fragments, real


def report(label, source, real, fragments, only):
    total = sum(source.values())
    real_hits = sum(source[w] for w in real)
    frag_hits = sum(source[w] for w in fragments)
    print(f"  {label}: {len(only):,}종({sum(source[w] for w in only):,}회)")
    print(f"      잘림 조각 {len(fragments):,}종({frag_hits:,}회) 제외")
    print(f"      → 실질 {len(real):,}종({real_hits:,}회, {real_hits / total * 100:.3f}%)")


def main() -> int:
    ap = argparse.ArgumentParser(description="마크다운 정본과 원본 PDF 텍스트의 실질 내용 차이")
    ap.add_argument("markdown", help="2층 정본 .md (또는 HWP 변환 .md)")
    ap.add_argument("pdftext", help="pdftotext -layout 결과 .txt")
    ap.add_argument("--top", type=int, default=60, help="출력할 실질 차이 어휘 수")
    ap.add_argument("--keep-digits", action="store_true",
                    help="숫자만인 어절(대개 쪽 번호)도 함께 출력")
    args = ap.parse_args()

    md_text = prep(open(args.markdown, encoding="utf-8").read(), True)
    pdf_text = prep(open(args.pdftext, encoding="utf-8").read(), False)
    md_words, pdf_words = Counter(TOKEN.findall(md_text)), Counter(TOKEN.findall(pdf_text))
    md_core, pdf_core = NON_WORD.sub("", md_text), NON_WORD.sub("", pdf_text)

    print(f"어휘 종수: 정본 {len(md_words):,} / PDF {len(pdf_words):,} / "
          f"공통 {len(set(md_words) & set(pdf_words)):,}")

    p_only, p_frag, p_real = split_real(pdf_words, md_words, md_core)
    m_only, m_frag, m_real = split_real(md_words, pdf_words, pdf_core)
    report("PDF에만", pdf_words, p_real, p_frag, p_only)
    report("정본에만", md_words, m_real, m_frag, m_only)

    for label, words, real in (("PDF에만 있는 실질 어휘", pdf_words, p_real),
                               ("정본에만 있는 실질 어휘", md_words, m_real)):
        shown = real if args.keep_digits else [w for w in real if not w.isdigit()]
        dropped = len(real) - len(shown)
        suffix = f" (숫자 {dropped}종 생략, 대개 쪽 번호)" if dropped else ""
        print(f"\n=== {label} {len(shown)}종{suffix} ===")
        for word in sorted(shown, key=lambda w: -words[w])[: args.top]:
            print(f"  {words[word]:>3}회 {word}")

    print("\n판정 지침: 실질 차이는 ① 수정 목록으로 교정한 오탈자 ② 개인정보 삭제분 "
          "③ 쪽 번호 ④ pdftotext가 표의 다른 열을 붙여 만든 유령 어절 중 하나로 "
          "설명되어야 한다. 설명되지 않는 항목이 진짜 판본 차이다.")
    print("주의: 「PDF에 없음」이 곧 「초안 잔여」는 아니다. 원본 PDF의 텍스트 레이어가 "
          "괄호 안 영문·숫자를 통째로 잃는 구간이 있다(2023 최종보고서 9쪽의 "
          "「(Reasonable Adjustment)」·「34」 실측, ligature 파싱 실패 계열). "
          "영문·숫자·괄호가 걸린 항목은 지우기 전에 원본 PDF 해당 쪽을 직접 확인할 것.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
