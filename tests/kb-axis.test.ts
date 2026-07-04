/**
 * src/lib/kb-axis.ts — axis 라벨·둘러보기 카탈로그·목록 정렬 단위 테스트.
 *
 * axis 목록 페이지(/disability-types 등)의 데이터 계약을 고정한다:
 *   - AXIS_LABEL이 모든 ContentAxis를 커버 (KbPageLayout 공유 출처)
 *   - BROWSABLE_AXES는 본문 5 axis만 (resources/stories/uncategorized 제외)
 *   - toListItem: frontmatter → 표시용 메타 (date 우선, year fallback)
 *   - sortDocsForList: 제목 가나다순 + slug 안정 정렬
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  AXIS_LABEL,
  BROWSABLE_AXES,
  isBrowsableAxis,
  toListItem,
  sortDocsForList,
  visibleAxisCards,
  type AxisDocListItem,
  type AxisCardEntry,
} from "@/lib/kb-axis"
import { CONTENT_AXES } from "@/types/kb"
import type { DocumentSummary, Frontmatter } from "@/types/kb"

describe("AXIS_LABEL", () => {
  it("모든 ContentAxis 키를 커버해야 한다", () => {
    for (const axis of CONTENT_AXES) {
      assert.ok(AXIS_LABEL[axis], `${axis} 라벨 누락`)
    }
  })
})

describe("BROWSABLE_AXES", () => {
  it("본문 axis + faq를 포함한다", () => {
    const axes = BROWSABLE_AXES.map((b) => b.axis)
    assert.deepEqual(
      [...axes].sort(),
      ["agreements", "disability-types", "domains", "faq", "policies", "regions"],
    )
  })

  it("resources·stories·uncategorized는 제외한다 (nested 라우트 / 콘텐츠 0건)", () => {
    const axes = BROWSABLE_AXES.map((b) => b.axis)
    assert.ok(!axes.includes("resources"))
    assert.ok(!axes.includes("stories"))
    assert.ok(!axes.includes("uncategorized"))
  })

  it("각 항목 label이 AXIS_LABEL 단일 출처와 일치한다", () => {
    for (const b of BROWSABLE_AXES) {
      assert.equal(b.label, AXIS_LABEL[b.axis])
      assert.ok(b.description.length > 0, `${b.axis} 설명 누락`)
    }
  })

  it("isBrowsableAxis가 대상/비대상을 구분한다", () => {
    assert.ok(isBrowsableAxis("policies"))
    assert.ok(!isBrowsableAxis("resources"))
    assert.ok(!isBrowsableAxis("uncategorized"))
  })
})

function fakeDoc(slug: string, fm: Partial<Frontmatter>): DocumentSummary {
  return {
    slug,
    axis: "policies",
    filePath: `content/policies/${slug}.md`,
    frontmatter: fm as Frontmatter,
  }
}

describe("toListItem", () => {
  it("date가 있으면 dateLabel로 그대로 쓴다", () => {
    const item = toListItem(fakeDoc("a", { title: "정책 A", date: "2024-03-11" }))
    assert.equal(item.title, "정책 A")
    assert.equal(item.dateLabel, "2024-03-11")
  })

  it("date가 없고 year만 있으면 `${year}년`으로 표시한다", () => {
    const item = toListItem(fakeDoc("b", { title: "정책 B", year: 2023 }))
    assert.equal(item.dateLabel, "2023년")
  })

  it("date·year 모두 없으면 dateLabel이 undefined", () => {
    const item = toListItem(fakeDoc("c", { title: "정책 C" }))
    assert.equal(item.dateLabel, undefined)
  })
})

describe("sortDocsForList", () => {
  it("제목 가나다순(ko)으로 정렬한다", () => {
    const items: AxisDocListItem[] = [
      { slug: "x", axis: "policies", title: "다항목" },
      { slug: "y", axis: "policies", title: "가항목" },
      { slug: "z", axis: "policies", title: "나항목" },
    ]
    const sorted = sortDocsForList(items)
    assert.deepEqual(
      sorted.map((s) => s.title),
      ["가항목", "나항목", "다항목"],
    )
  })

  it("동일 제목이면 slug로 안정 정렬한다", () => {
    const items: AxisDocListItem[] = [
      { slug: "b-slug", axis: "policies", title: "같은제목" },
      { slug: "a-slug", axis: "policies", title: "같은제목" },
    ]
    const sorted = sortDocsForList(items)
    assert.deepEqual(
      sorted.map((s) => s.slug),
      ["a-slug", "b-slug"],
    )
  })

  it("원본 배열을 변형하지 않는다 (순수 함수)", () => {
    const items: AxisDocListItem[] = [
      { slug: "x", axis: "policies", title: "나" },
      { slug: "y", axis: "policies", title: "가" },
    ]
    const before = items.map((i) => i.slug)
    sortDocsForList(items)
    assert.deepEqual(
      items.map((i) => i.slug),
      before,
    )
  })
})

describe("visibleAxisCards", () => {
  const base = { axis: "faq", label: "자주 묻는 질문", description: "d" } as const

  it("count가 0인 카드는 숨긴다", () => {
    const entries: AxisCardEntry[] = [
      { ...base, axis: "faq", count: 0 },
      { ...base, axis: "policies", label: "정책·법령", count: 3 },
    ]
    const visible = visibleAxisCards(entries)
    assert.deepEqual(
      visible.map((e) => e.axis),
      ["policies"],
    )
  })

  it("count가 1 이상인 카드는 모두 남긴다", () => {
    const entries: AxisCardEntry[] = [
      { ...base, axis: "faq", count: 2 },
      { ...base, axis: "policies", label: "정책·법령", count: 3 },
    ]
    assert.equal(visibleAxisCards(entries).length, 2)
  })

  it("원본 배열을 변형하지 않는다", () => {
    const entries: AxisCardEntry[] = [{ ...base, axis: "faq", count: 0 }]
    visibleAxisCards(entries)
    assert.equal(entries.length, 1)
  })
})
