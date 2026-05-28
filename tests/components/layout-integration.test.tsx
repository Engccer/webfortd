import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "../../src")

describe("Layout integration (T10) — regression guard against accidentally re-introducing old structure", () => {
  it("(gov)/layout.tsx uses AppShell", () => {
    const content = fs.readFileSync(path.join(ROOT, "app/(gov)/layout.tsx"), "utf8")
    expect(content).toMatch(/AppShell/)
    expect(content).toMatch(/readSidebarCookieServer/)
    // No more direct Header rendering inside the layout
    expect(content).not.toMatch(/<Header\s*\/>/)
    expect(content).not.toMatch(/<Footer\s*\/>/)
    expect(content).not.toMatch(/<SkipLink\s*\/>/)
  })

  it("(wiki)/layout.tsx uses AppShell wrapped in AuthProvider", () => {
    const content = fs.readFileSync(path.join(ROOT, "app/(wiki)/layout.tsx"), "utf8")
    expect(content).toMatch(/AppShell/)
    expect(content).toMatch(/AuthProvider/)
    expect(content).toMatch(/readSidebarCookieServer/)
    // No more inline header
    expect(content).not.toMatch(/<header\b/)
    expect(content).not.toMatch(/<SkipLink\s*\/>/)
    expect(content).not.toMatch(/EntryToggle/)
    expect(content).not.toMatch(/SignInButton/)
  })

  it("root layout.tsx reads sidebar cookie and adds data-sidebar-expanded attribute", () => {
    const content = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8")
    expect(content).toMatch(/readSidebarCookieServer/)
    expect(content).toMatch(/data-sidebar-expanded/)
    expect(content).toMatch(/async function RootLayout/)
  })

  it("root layout still uses ThemeProvider", () => {
    const content = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8")
    expect(content).toMatch(/ThemeProvider/)
  })
})
