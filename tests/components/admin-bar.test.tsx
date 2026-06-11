import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const refreshMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { AdminBarView } from "@/components/admin/AdminBarView"

const admin = { isAdmin: true, userId: "admin-1", email: "admin@example.com" }

beforeEach(() => {
  refreshMock.mockClear()
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify({ enabled: true }), { status: 200 }),
  ) as typeof fetch
})

describe("AdminBarView", () => {
  it("isAdmin=false → null", () => {
    const { container } = render(
      <AdminBarView
        status={{ isAdmin: false, userId: null, email: null }}
        previewEnabled={false}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("isAdmin=true → region + 관리자 모드 + 대시보드 링크", () => {
    render(<AdminBarView status={admin} previewEnabled={false} />)
    expect(screen.getByRole("region", { name: /관리자 도구/ })).toBeDefined()
    expect(screen.getByText("관리자 모드")).toBeDefined()
    expect(screen.getByText("admin@example.com")).toBeDefined()
    expect(
      screen.getByRole("link", { name: "대시보드" }).getAttribute("href"),
    ).toBe("/admin/dashboard")
  })

  // a11y 패치(2026-06-11): 동작 라벨 단독 패턴 — 라벨 토글 + aria-pressed 병용은
  // "미리보기 끄기, 눌림" 같은 모순 낭독을 만들어 aria-pressed를 제거함.
  it("previewEnabled=false → '미리보기 켜기' (aria-pressed 없음)", () => {
    render(<AdminBarView status={admin} previewEnabled={false} />)
    const btn = screen.getByRole("button", { name: /미리보기 켜기/ })
    expect(btn.hasAttribute("aria-pressed")).toBe(false)
  })

  it("previewEnabled=true → '미리보기 끄기' (aria-pressed 없음)", () => {
    render(<AdminBarView status={admin} previewEnabled={true} />)
    const btn = screen.getByRole("button", { name: /미리보기 끄기/ })
    expect(btn.hasAttribute("aria-pressed")).toBe(false)
  })

  it("토글 클릭(off→on) → enable POST + router.refresh + aria-live 알림", async () => {
    const user = userEvent.setup()
    render(<AdminBarView status={admin} previewEnabled={false} />)
    await user.click(screen.getByRole("button", { name: /미리보기 켜기/ }))
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/preview/enable",
      expect.objectContaining({ method: "POST" }),
    )
    expect(refreshMock).toHaveBeenCalled()
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toMatch(/켰습니다/)
  })

  it("토글 클릭(on→off) → disable POST", async () => {
    const user = userEvent.setup()
    render(<AdminBarView status={admin} previewEnabled={true} />)
    await user.click(screen.getByRole("button", { name: /미리보기 끄기/ }))
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/preview/disable",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
