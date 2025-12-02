"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNavigation } from "@/lib/navigation"
import { playMenuOpenSound, playMenuFocusSound } from "@/lib/sound"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { Button } from "@/components/ui/Button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      {/* Top Bar */}
      <div className="border-b border-border bg-muted/50">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="text-xs text-muted-foreground">
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
            className="flex items-center gap-2 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span className="text-primary">장애인교원</span>
            <span className="hidden sm:inline">교육전념 여건 지원</span>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden lg:block" id="main-nav" viewport={false}>
            <NavigationMenuList>
              {mainNavigation.map((item) => (
                <NavigationMenuItem key={item.href}>
                  {item.children ? (
                    <>
                      <NavigationMenuTrigger
                        className={cn(
                          pathname.startsWith(item.href) && "text-primary"
                        )}
                        onPointerEnter={() => playMenuFocusSound()}
                        onClick={() => playMenuOpenSound()}
                      >
                        {item.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[200px] gap-1 p-2">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <NavigationMenuLink asChild>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "block select-none rounded-md px-3 py-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                                    pathname === child.href &&
                                      "bg-primary/10 text-primary"
                                  )}
                                >
                                  {child.title}
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <Link href={item.href} legacyBehavior passHref>
                      <NavigationMenuLink
                        className={cn(
                          navigationMenuTriggerStyle(),
                          pathname === item.href && "text-primary"
                        )}
                      >
                        {item.title}
                      </NavigationMenuLink>
                    </Link>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Search & Mobile Menu Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              id="search-input"
              className="gap-2"
              aria-label="검색"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">검색...</span>
            </Button>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="메뉴 열기"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>메뉴</SheetTitle>
                </SheetHeader>
                <nav className="mt-6">
                  <ul className="space-y-2">
                    {mainNavigation.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                            pathname.startsWith(item.href)
                              ? "text-primary"
                              : "text-foreground"
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
                                    "block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                                    pathname === child.href
                                      ? "text-primary"
                                      : "text-muted-foreground"
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
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
