/**
 * Sidebar expansion state cookie helpers.
 * - Cookie value: "1" expanded, "0" collapsed.
 * - Default (cookie absent): expanded=true.
 * - Cookie name uses a hyphen (not colon) per RFC 6265 §4.1.1 token rules —
 *   `:` is a reserved separator and `next/server` cookies().set() would throw.
 * - httpOnly=false because the client toggles directly; SameSite=Lax, Secure in production.
 */

export const SIDEBAR_COOKIE_NAME = "sidebar-expanded"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Returns true unless value is exactly "0". Unrecognized or empty strings
 * default to true (fail-open: prefer expanded over collapsed when cookie
 * state is unclear).
 */
export function parseSidebarCookie(value: string | undefined): boolean {
  if (value === "0") return false
  return true
}

/**
 * Server-side cookie read. Uses next/headers cookies(). Call inside a Server
 * Component or Route Handler. Returns the parsed boolean (default true).
 */
export async function readSidebarCookieServer(): Promise<boolean> {
  const { cookies } = await import("next/headers")
  const store = await cookies()
  return parseSidebarCookie(store.get(SIDEBAR_COOKIE_NAME)?.value)
}

/**
 * Client-side cookie write. No-op on server (typeof document undefined).
 * SameSite=Lax, Secure when running over HTTPS.
 */
export function writeSidebarCookieClient(expanded: boolean): void {
  // Guard: SSR safety. Not covered by jsdom tests — document is always defined there.
  if (typeof document === "undefined") return
  const value = expanded ? "1" : "0"
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
}
