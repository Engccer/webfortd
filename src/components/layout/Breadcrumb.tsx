"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home } from "lucide-react"
import { mainNavigation } from "@/lib/navigation"
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface BreadcrumbItemType {
  title: string
  href: string
}

function getBreadcrumbs(pathname: string): BreadcrumbItemType[] {
  const items: BreadcrumbItemType[] = [{ title: "홈", href: "/" }]

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
    <BreadcrumbRoot className="mb-6">
      <BreadcrumbList>
        {items.map((item, index) => (
          <BreadcrumbItem key={item.href}>
            {index > 0 && <BreadcrumbSeparator />}
            {index === items.length - 1 ? (
              <BreadcrumbPage>
                {item.title === "홈" ? <Home className="h-4 w-4" /> : item.title}
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={item.href}>
                  {item.title === "홈" ? <Home className="h-4 w-4" /> : item.title}
                </Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </BreadcrumbRoot>
  )
}
