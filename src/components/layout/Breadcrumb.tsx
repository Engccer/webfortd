"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { mainNavigation } from "@/lib/navigation"

interface BreadcrumbItem {
  title: string
  href: string
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ title: "홈", href: "/" }]

  if (pathname === "/") return items

  const segments = pathname.split("/").filter(Boolean)
  let currentPath = ""

  for (const segment of segments) {
    currentPath += `/${segment}`

    // Find matching nav item
    const findItem = (navItems: typeof mainNavigation): string | null => {
      for (const item of navItems) {
        if (item.href === currentPath) return item.title
        if (item.children) {
          const childResult = findItem(item.children)
          if (childResult) return childResult
        }
      }
      return null
    }

    const title = findItem(mainNavigation)
    if (title) {
      items.push({ title, href: currentPath })
    }
  }

  return items
}

export function Breadcrumb() {
  const pathname = usePathname()
  const items = getBreadcrumbs(pathname)

  if (items.length <= 1) return null

  return (
    <nav aria-label="breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
            )}
            {index === items.length - 1 ? (
              <span className="font-medium text-gray-900" aria-current="page">
                {item.title === "홈" ? <Home className="h-4 w-4" /> : item.title}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-600 hover:text-blue-600 hover:underline"
              >
                {item.title === "홈" ? <Home className="h-4 w-4" /> : item.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
