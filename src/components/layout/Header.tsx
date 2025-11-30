"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as NavigationMenu from "@radix-ui/react-navigation-menu"
import { Menu, X, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNavigation } from "@/lib/navigation"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      {/* Top Bar */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="text-xs text-gray-600">
            장애인교원의 교육활동을 지원합니다
          </div>
          <div className="flex items-center gap-4">
            <AccessibilityToolbar />
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span className="text-blue-600">장애인교원</span>
            <span className="hidden sm:inline">교육전념 여건 지원</span>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu.Root className="hidden lg:block" id="main-nav" tabIndex={-1}>
            <NavigationMenu.List className="flex items-center gap-1">
              {mainNavigation.map((item) => (
                <NavigationMenu.Item key={item.href}>
                  {item.children ? (
                    <>
                      <NavigationMenu.Trigger
                        className={cn(
                          "group flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
                          pathname.startsWith(item.href)
                            ? "text-blue-600"
                            : "text-gray-700"
                        )}
                      >
                        {item.title}
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content className="absolute left-0 top-full w-auto min-w-[200px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                        <ul className="space-y-1">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <NavigationMenu.Link asChild>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
                                    pathname === child.href
                                      ? "bg-blue-50 text-blue-600"
                                      : "text-gray-700"
                                  )}
                                >
                                  {child.title}
                                </Link>
                              </NavigationMenu.Link>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenu.Content>
                    </>
                  ) : (
                    <NavigationMenu.Link asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
                          pathname === item.href
                            ? "text-blue-600"
                            : "text-gray-700"
                        )}
                      >
                        {item.title}
                      </Link>
                    </NavigationMenu.Link>
                  )}
                </NavigationMenu.Item>
              ))}
            </NavigationMenu.List>
            <NavigationMenu.Viewport />
          </NavigationMenu.Root>

          {/* Search & Mobile Menu Button */}
          <div className="flex items-center gap-2">
            <button
              id="search-input"
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="검색"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">검색...</span>
            </button>

            <button
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="border-t border-gray-200 bg-white lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <ul className="space-y-2">
              {mainNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100",
                      pathname.startsWith(item.href)
                        ? "text-blue-600"
                        : "text-gray-700"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.title}
                  </Link>
                  {item.children && (
                    <ul className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-gray-100",
                              pathname === child.href
                                ? "text-blue-600"
                                : "text-gray-600"
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </header>
  )
}
