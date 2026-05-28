import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "../../src")

describe("(wiki)/page.tsx — content sections", () => {
  it("imports WikiHero, RoleEntries, PopularPages but NOT ChatLibraryMediaEntries", () => {
    const content = fs.readFileSync(path.join(ROOT, "app/(wiki)/page.tsx"), "utf8")
    expect(content).toMatch(/WikiHero/)
    expect(content).toMatch(/RoleEntries/)
    expect(content).toMatch(/PopularPages/)
    expect(content).not.toMatch(/ChatLibraryMediaEntries/)
  })
})
