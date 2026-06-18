/**
 * axis 목록 페이지의 문서 리스트 — 서버 컴포넌트.
 *
 * 접근성: 링크의 접근 가능한 이름은 **제목만**이 되도록 날짜·설명을 링크 밖에 둔다.
 * 스크린리더 사용자가 링크 목록을 순회할 때 "특수 마우스", "비교과 활동 입력"처럼
 * 제목만 또렷이 읽힌다(부가 메타가 링크 이름에 섞이지 않음).
 * 시맨틱 <ul>/<li>를 쓰므로 role="list" 같은 중복 role은 주지 않는다.
 */

import Link from "next/link"
import type { AxisDocListItem } from "@/lib/kb-axis"

export function AxisDocList({ items }: { items: AxisDocListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground">
        아직 등록된 문서가 없습니다.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.slug} className="py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href={`/${item.axis}/${item.slug}`}
              className="font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
            >
              {item.title}
            </Link>
            {item.dateLabel && (
              <span className="text-sm text-muted-foreground">{item.dateLabel}</span>
            )}
          </div>
          {item.description && (
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
