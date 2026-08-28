#!/usr/bin/env python3
"""지원인력 안내자료 부록2: 표 안 기기 사진은 HWPX에서 추출되지 않아 셀이 빈다. 직전 항목명(- 기기명)으로 「(사진: …)」를 채운다."""
import re, sys
p = sys.argv[1]
L = open(p, encoding="utf-8").read().split("\n"); name = None; n = 0; missed = 0
for i, l in enumerate(L):
    m = re.match(r"^- (.+)$", l)
    if m:
        name = m.group(1).strip()
    if l == "| 관련 사진 |  |":
        if name:
            L[i] = f"| 관련 사진 | (사진: {name}) |"; n += 1; name = None  # 같은 항목명을 두 번 쓰지 않는다
        else:
            missed += 1
open(p, "w", encoding="utf-8").write("\n".join(L)); print(f"관련 사진 셀 채움 {n}건, 직전 항목명 없어 미채움 {missed}건")
if missed:
    sys.exit(1)
