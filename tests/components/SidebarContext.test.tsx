import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext"

function Probe() {
  const { isExpanded, isMobileOpen, isMobile, toggle, openMobile, closeMobile } = useSidebar()
  return (
    <div>
      <span data-testid="expanded">{String(isExpanded)}</span>
      <span data-testid="mobile-open">{String(isMobileOpen)}</span>
      <span data-testid="mobile">{String(isMobile)}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={openMobile}>openMobile</button>
      <button onClick={closeMobile}>closeMobile</button>
    </div>
  )
}

describe("SidebarContext", () => {
  it("desktop: toggle inverts isExpanded", async () => {
    const user = userEvent.setup()
    render(
      <SidebarProvider initialExpanded={true} initialIsMobile={false}>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("expanded").textContent).toBe("true")
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("expanded").textContent).toBe("false")
  })

  it("mobile: toggle inverts isMobileOpen, leaves isExpanded alone", async () => {
    const user = userEvent.setup()
    render(
      <SidebarProvider initialExpanded={true} initialIsMobile={true}>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("mobile-open").textContent).toBe("false")
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("mobile-open").textContent).toBe("true")
    expect(screen.getByTestId("expanded").textContent).toBe("true")
  })

  it("openMobile/closeMobile control isMobileOpen explicitly", async () => {
    const user = userEvent.setup()
    render(
      <SidebarProvider initialExpanded={true} initialIsMobile={true}>
        <Probe />
      </SidebarProvider>,
    )
    await user.click(screen.getByRole("button", { name: "openMobile" }))
    expect(screen.getByTestId("mobile-open").textContent).toBe("true")
    await user.click(screen.getByRole("button", { name: "closeMobile" }))
    expect(screen.getByTestId("mobile-open").textContent).toBe("false")
  })

  it("useSidebar throws outside provider", () => {
    expect(() => render(<Probe />)).toThrow(/SidebarProvider/)
  })

  it("respects initialMobileOpen prop", () => {
    render(
      <SidebarProvider initialExpanded={true} initialIsMobile={true} initialMobileOpen={true}>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("mobile-open").textContent).toBe("true")
  })

  it("toggle adapts when setIsMobile flips mid-session", async () => {
    const user = userEvent.setup()
    function Probe2() {
      const { isExpanded, isMobileOpen, toggle, setIsMobile } = useSidebar()
      return (
        <div>
          <span data-testid="expanded">{String(isExpanded)}</span>
          <span data-testid="mobile-open">{String(isMobileOpen)}</span>
          <button onClick={toggle}>toggle</button>
          <button onClick={() => setIsMobile(false)}>setDesktop</button>
        </div>
      )
    }
    render(
      <SidebarProvider initialExpanded={true} initialIsMobile={true}>
        <Probe2 />
      </SidebarProvider>,
    )
    // mobile mode: toggle flips isMobileOpen
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("mobile-open").textContent).toBe("true")
    expect(screen.getByTestId("expanded").textContent).toBe("true")
    // flip to desktop
    await user.click(screen.getByRole("button", { name: "setDesktop" }))
    // desktop mode: toggle now flips isExpanded
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("expanded").textContent).toBe("false")
    expect(screen.getByTestId("mobile-open").textContent).toBe("true") // unchanged
  })
})
