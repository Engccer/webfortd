import Link from "next/link"
import { POPULAR_PAGES } from "@/lib/wiki-popular"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

export function PopularPages() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          자주 찾는 문서
        </h2>
        <p className="text-xs text-muted-foreground">큐레이션 · 베타</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {POPULAR_PAGES.map((page) => (
          <Link
            key={page.slug}
            href={page.href}
            className="group focus:outline-none"
          >
            <Card className="h-full transition-colors hover:border-primary hover:bg-primary/5 focus-within:border-primary">
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  {page.axis}
                </Badge>
                <CardTitle className="mt-2 flex items-start justify-between gap-2 text-base">
                  <span>{page.title}</span>
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{page.reason}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
