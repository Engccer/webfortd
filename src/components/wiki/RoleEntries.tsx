import Link from "next/link"
import { User, School, Building, Scale, Heart } from "lucide-react"
import { ROLE_ENTRIES, type Role } from "@/lib/wiki-role-entries"

const ICON_MAP: Record<Role | "default", typeof User> = {
  teacher: User,
  manager: School,
  office: Building,
  policy: Scale,
  parent: Heart,
  default: User,
}

export function RoleEntries() {
  return (
    <section
      aria-labelledby="role-entries-heading"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6"
    >
      <div className="mb-6">
        <h2
          id="role-entries-heading"
          className="text-xl font-semibold text-foreground sm:text-2xl"
        >
          역할별 진입점
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          어떤 역할이신가요? 가장 필요한 정보로 안내해 드립니다.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ROLE_ENTRIES.map((entry) => {
          const Icon = ICON_MAP[entry.role] ?? ICON_MAP.default
          return (
            <article
              key={entry.role}
              className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground">{entry.title}</h3>
              <p className="mb-3 flex-1 text-xs text-muted-foreground">{entry.description}</p>
              {entry.recommended.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {entry.recommended.map((rec) => (
                    <li key={rec.slug}>
                      <Link
                        href={`/${rec.axis}/${rec.slug}`}
                        className="block rounded px-1 py-0.5 text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <span className="font-medium">{rec.title}</span>
                        <span className="ml-1 text-muted-foreground">— {rec.reason}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-muted-foreground">큐레이션 준비 중</p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
