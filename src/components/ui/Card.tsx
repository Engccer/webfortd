import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface CardProps {
  title: string
  description: string
  href: string
  icon?: React.ReactNode
  className?: string
}

export function Card({ title, description, href, icon, className }: CardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        className
      )}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
            {title}
          </h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  )
}

interface SimpleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SimpleCard({ children, className, ...props }: SimpleCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
