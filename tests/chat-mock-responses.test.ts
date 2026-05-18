import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchMockResponse,
  MOCK_RESPONSES,
  FALLBACK_RESPONSE,
} from "@/lib/chat-mock-responses"

describe("matchMockResponse", () => {
  it("returns FALLBACK_RESPONSE for empty input", () => {
    const result = matchMockResponse("")
    assert.strictEqual(result.answer, FALLBACK_RESPONSE.answer)
  })

  it("matches 특수 마우스 keyword to mouse response with source", () => {
    const r = matchMockResponse("특수 마우스에는 어떤 종류가 있나요?")
    assert(r.answer.includes("트랙볼"), "답변에 '트랙볼'이 포함되어야 함")
    assert.deepStrictEqual(r.sources, [
      { href: "/disability-types/2024-staff-p-183", title: "특수 마우스" },
    ])
  })

  it("matches 조례 keyword to ordinance response", () => {
    const r = matchMockResponse("편의지원 조례 시도교육청")
    assert(r.answer.includes("9개 시도교육청"), "답변에 '9개 시도교육청'이 포함되어야 함")
    assert.strictEqual(r.sources[0].href, "/resources/law/ordinance-comparison")
  })

  it("returns FALLBACK_RESPONSE for unknown topic", () => {
    const r = matchMockResponse("점심 메뉴 추천")
    assert.strictEqual(r.answer, FALLBACK_RESPONSE.answer)
    assert.strictEqual(r.sources.length, 0)
  })

  it("each MOCK_RESPONSES entry has at least one keyword and one source", () => {
    for (const m of MOCK_RESPONSES) {
      assert(m.keywords.length > 0, "각 MOCK_RESPONSES는 최소 1개 keyword을 가져야 함")
      assert(m.sources.length > 0, "각 MOCK_RESPONSES는 최소 1개 source를 가져야 함")
    }
  })
})
