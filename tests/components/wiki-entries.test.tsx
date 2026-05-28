import { describe, it, expect } from "vitest"
import { wikiEntries } from "@/lib/wiki-entries"

describe("wiki-entries", () => {
  it("exports exactly 5 entries", () => {
    expect(wikiEntries).toHaveLength(5)
  })

  it("entries are ordered: 위키 홈 → 채팅 → 자료실 → 미디어 → About", () => {
    expect(wikiEntries.map((e) => e.href)).toEqual([
      "/",
      "/chat",
      "/library",
      "/media",
      "/about",
    ])
  })

  it("titles use plain Korean text — no emoji, no 'AI'", () => {
    for (const e of wikiEntries) {
      expect(e.title).not.toMatch(/AI/i)
      // emoji range guard (basic — covers most emoji)
      expect(e.title).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })

  it("each entry has an icon component (function or forwardRef object)", () => {
    for (const e of wikiEntries) {
      // lucide-react components are forwardRef render functions or function components
      expect(typeof e.icon === "function" || typeof e.icon === "object").toBe(true)
    }
  })
})
