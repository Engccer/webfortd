import { describe, it, expect, beforeEach } from "vitest"
import {
  SIDEBAR_COOKIE_NAME,
  parseSidebarCookie,
  writeSidebarCookieClient,
} from "@/lib/sidebar-cookie"

describe("sidebar-cookie", () => {
  beforeEach(() => {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })

  it("parseSidebarCookie returns true for '1'", () => {
    expect(parseSidebarCookie("1")).toBe(true)
  })

  it("parseSidebarCookie returns false for '0'", () => {
    expect(parseSidebarCookie("0")).toBe(false)
  })

  it("parseSidebarCookie returns default true for undefined", () => {
    expect(parseSidebarCookie(undefined)).toBe(true)
  })

  it("parseSidebarCookie returns default true for empty string", () => {
    expect(parseSidebarCookie("")).toBe(true)
  })

  it("parseSidebarCookie returns default true for unrecognized value", () => {
    expect(parseSidebarCookie("corrupt")).toBe(true)
  })

  it("writeSidebarCookieClient sets cookie with expected value", () => {
    writeSidebarCookieClient(false)
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE_NAME}=0`)
    writeSidebarCookieClient(true)
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE_NAME}=1`)
  })
})
