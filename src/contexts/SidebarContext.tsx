"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export interface SidebarState {
  isExpanded: boolean
  isMobileOpen: boolean
  isMobile: boolean
  toggle: () => void
  openMobile: () => void
  closeMobile: () => void
  setIsMobile: (mobile: boolean) => void
}

const SidebarContext = createContext<SidebarState | null>(null)

export interface SidebarProviderProps {
  children: ReactNode
  initialExpanded: boolean
  initialIsMobile: boolean
}

export function SidebarProvider({
  children,
  initialExpanded,
  initialIsMobile,
}: SidebarProviderProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(initialIsMobile)

  // desktop: isExpanded 토글, 모바일: isMobileOpen 토글 (isMobile 분기)
  const toggle = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen((v) => !v)
    } else {
      setIsExpanded((v) => !v)
    }
  }, [isMobile])

  const openMobile = useCallback(() => setIsMobileOpen(true), [])
  const closeMobile = useCallback(() => setIsMobileOpen(false), [])

  const value = useMemo<SidebarState>(
    () => ({
      isExpanded,
      isMobileOpen,
      isMobile,
      toggle,
      openMobile,
      closeMobile,
      setIsMobile,
    }),
    [isExpanded, isMobileOpen, isMobile, toggle, openMobile, closeMobile, setIsMobile],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return ctx
}
